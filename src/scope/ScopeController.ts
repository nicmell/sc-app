/**
 * One scope instance — owns the scope synth, its dedicated buffer,
 * and a worker subscription. Pure consumer: reads from a bus the
 * caller specifies (typically allocated by a `SynthController` or
 * external scsynth chain) and renders the signal via `ScopeView`.
 *
 * Phase 17 adapter shim: subscribes to the worker via the unified
 * `subscribeBuffer` API, deriving a per-controller `bufferId` from
 * its `scopeId`. The buffer + tap synth are still owned per-scope —
 * Phase 19 will move them into `BufferManager` so two scopes on the
 * same bus share one buffer + tap. The shim is throwaway at that
 * point.
 *
 * Skip-first-chunk: the first half after subscribing straddles
 * /b_alloc (zero-fill) and the partial first half written between
 * /s_new and the first tick boundary. The worker's
 * `skipFirstTick: true` (default on `BufferSubscription`) drops the
 * read entirely, so the displayed waveform never shows that
 * initial dropout.
 */

import {
  AddToTail,
  bAlloc,
  bFree,
  nFree,
  sNew,
} from '@sc-app/server-commands';
import {
  compileScopeSynthDef,
  scopeSynthDefName,
} from '@/synthdefs/scopeSynthDef';
import type { ClockController } from '@/clock/ClockController';
import type { GroupController } from '@/server/GroupController';
import type { IdAllocator } from '@/server/IdAllocator';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import type { SynthDefRegistry } from '@/server/SynthDefRegistry';
import type { WorkerClient } from '@/server/WorkerClient';
import type { BufferChunk } from '@/server/workerProtocol';

export interface ScopeControllerOptions {
  client: WorkerClient;
  clock: ClockController;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator; buffer: IdAllocator };
  /** First audio bus index in this scope's contiguous block. The
   *  block runs `[inputBus, inputBus + channels)`. The caller is
   *  responsible for ensuring something is producing audio on that
   *  bus — typically a `SynthController` from the Synths panel, or
   *  an external scsynth chain. */
  inputBus: number;
  channels: number;
  /** Stable id for worker subscription routing + UI list keys. */
  scopeId: string;
  /** Free-form label used by the UI. Optional — the manager defaults
   *  to something readable. */
  label?: string;
}

export class ScopeController {
  readonly scopeId: string;
  readonly label: string;
  readonly channels: number;
  readonly inputBus: number;
  /** Effective audio rate this scope produces. With `decimation = 1`
   *  this is just the clock's sampleRate; kept as a dedicated field
   *  so `ScopeView` doesn't have to reach through the clock. */
  readonly effectiveRate: number;
  /** Samples per chunk = `clock.derived.samplesPerTick`. Mirrors the
   *  global setting at construction time so the rendering view can
   *  read it as a stable per-scope value (the global may change
   *  later via re-init, but this scope's resources are torn down
   *  before that). */
  readonly samplesPerChunk: number;

  /** Mutable single-slot ref consumed by `ScopeView`'s RAF loop. The
   *  draw routine reads `.current` once per frame; older frames are
   *  overwritten as new chunks arrive. */
  readonly chunkRef: { current: BufferChunk | null } = { current: null };

  private readonly client: WorkerClient;
  private readonly clock: ClockController;
  private readonly group: GroupController;
  private readonly registry: SynthDefRegistry;
  private readonly nodeIds: IdAllocator;
  private readonly bufferIds: IdAllocator;

  private readonly latestChunkStore = createStore<BufferChunk | null>(null);
  private readonly chunksPerSecStore = createStore<number>(0);
  /** Sliding 1-second window of chunk-arrival timestamps used to derive
   *  `chunksPerSec`. Kept on the instance so `start` / `stop` can
   *  reset it cleanly. */
  private recentArrivals: number[] = [];

  private scopeNodeId: number | null = null;
  private bufnum: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private started = false;

  constructor(opts: ScopeControllerOptions) {
    this.client = opts.client;
    this.clock = opts.clock;
    this.group = opts.group;
    this.registry = opts.registry;
    this.nodeIds = opts.ids.node;
    this.bufferIds = opts.ids.buffer;
    this.inputBus = opts.inputBus;
    this.channels = opts.channels;
    this.scopeId = opts.scopeId;
    this.label = opts.label ?? `scope ${opts.scopeId.slice(0, 6)}`;
    this.samplesPerChunk = opts.clock.derived.samplesPerTick;
    this.effectiveRate = opts.clock.env.sampleRate;
  }

  /** Latest chunk seen by the subscription. Useful for stats / non-RAF
   *  consumers; the canvas reads `chunkRef` directly. */
  get latestChunk(): ReadonlyStore<BufferChunk | null> {
    return this.latestChunkStore;
  }

  /** Rolling 1-second chunk arrival rate. Approximately `tickRate` once
   *  the subscription is healthy. */
  get chunksPerSec(): ReadonlyStore<number> {
    return this.chunksPerSecStore;
  }

  /** Bring up the scope: load defs, allocate buffer, /s_new the
   *  scope synth, register the worker subscription. Idempotent. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const chunkSize = this.samplesPerChunk;
    const synthName = scopeSynthDefName(this.channels, chunkSize);
    await this.registry.ensureLoaded(
      synthName,
      compileScopeSynthDef(this.channels, chunkSize),
    );

    const bufnum = this.bufferIds.next();
    // bAlloc takes (bufnum, numFrames, numChannels). For multi-channel
    // scopes the buffer holds N samples × C channels interleaved, so
    // numFrames is `chunkSize × 2` — scsynth multiplies by numChannels.
    const ring = chunkSize * 2;
    await this.client.sendAndSync(bAlloc(bufnum, ring, this.channels));
    this.bufnum = bufnum;

    const nodeId = this.nodeIds.next();
    await this.client.sendAndSync(
      sNew(synthName, nodeId, AddToTail, this.group.groupId, {
        inBus: this.inputBus,
        bufnum,
        clockBus: this.clock.clockBus,
      }),
    );
    this.scopeNodeId = nodeId;

    // Phase 17 adapter shim: derive a per-controller `bufferId` so
    // the worker keys its subscription on it. Phase 19 retires this
    // in favour of `BufferManager.acquire(spec)`.
    const handle = this.client.subscribeBuffer(
      {
        bufferId: `scope-${this.scopeId}`,
        bufnum,
        chunkSize,
        channels: this.channels,
      },
      (chunk) => this.handleChunk(chunk),
    );
    this.unsubscribe = handle.unsubscribe;
  }

  /** Tear down everything `start()` allocated. Best-effort: each
   *  /n_free / /b_free is wrapped so a single server failure can't
   *  strand the rest. Idempotent. */
  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.chunkRef.current = null;
    this.latestChunkStore.set(null);
    this.chunksPerSecStore.set(0);
    this.recentArrivals = [];

    if (this.scopeNodeId !== null) {
      try {
        await this.client.sendAndSync(nFree(this.scopeNodeId));
      } catch (err) {
        console.warn(`[sc:scope ${this.scopeId}] scope nFree failed`, err);
      }
      this.scopeNodeId = null;
    }
    if (this.bufnum !== null) {
      try {
        await this.client.sendAndSync(bFree(this.bufnum));
      } catch (err) {
        console.warn(`[sc:scope ${this.scopeId}] bFree failed`, err);
      }
      this.bufnum = null;
    }
  }

  // ── Internals ─────────────────────────────────────────────────────

  private handleChunk(chunk: BufferChunk): void {
    // Scopes ignore `chunk.isGap` — a gap is rendered as silence,
    // which is exactly what the zero-fill draws.
    this.chunkRef.current = chunk;
    this.latestChunkStore.set(chunk);

    const now = performance.now();
    this.recentArrivals.push(now);
    while (
      this.recentArrivals.length > 0 &&
      this.recentArrivals[0] < now - 1000
    ) {
      this.recentArrivals.shift();
    }
    this.chunksPerSecStore.set(this.recentArrivals.length);
  }
}
