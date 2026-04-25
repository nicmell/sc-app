/**
 * One scope instance — owns the scope synth, its dedicated buffer,
 * and (optionally) a bundled source synth feeding the input bus.
 *
 * Each scope is independent: its own bus block (auto-allocated by
 * `ScopeManager`), its own buffer, its own worker subscription. The
 * clock + parent group + worker + compiled scopeTap{N}ch SynthDef
 * bytes are shared at the manager level.
 *
 * Skip-first-chunk: the first chunk that lands after subscribing
 * straddles the moment of `/b_alloc` (which zero-fills) plus the
 * partial first half written by the scope synth between /s_new and
 * the next tick boundary. We drop it so the displayed waveform never
 * shows that initial dropout. From chunk #2 onwards the parity-based
 * "completed half" guarantee in the worker takes over.
 */

import {
  AddToTail,
  bAlloc,
  bFree,
  nFree,
  sNew,
} from '@sc-app/server-commands';
import { DEFAULT_PARAMS } from '@/config/clockConfig';
import {
  compileScopeSynthDef,
  scopeSynthDefName,
} from '@/synth/scopeSynthDef';
import {
  TEST_TONE_STEREO_SYNTHDEF_NAME,
  TEST_TONE_SYNTHDEF_NAME,
  compileTestToneStereoSynthDef,
  compileTestToneSynthDef,
} from '@/synth/testToneSynthDef';
import type { ClockController } from './ClockController';
import type { GroupController } from './GroupController';
import type { IdAllocator } from './IdAllocator';
import { createStore, type ReadonlyStore } from './reactiveStore';
import type { SynthDefRegistry } from './SynthDefRegistry';
import type { WorkerClient } from './WorkerClient';
import type { ScopeChunk } from './workerProtocol';

export type ScopeSourceSpec =
  | { kind: 'mono'; freq: number; amp?: number }
  | { kind: 'stereo'; freqL: number; freqR: number; amp?: number };

const DEFAULT_TONE_AMP = 0.2;
const SCOPE_RING = DEFAULT_PARAMS.scopeChunkSize * 2;

export interface ScopeControllerOptions {
  client: WorkerClient;
  clock: ClockController;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator; buffer: IdAllocator };
  /** First audio bus index in this scope's contiguous block. The
   *  block runs `[inputBus, inputBus + channels)`. */
  inputBus: number;
  channels: 1 | 2;
  /** Stable id for worker subscription routing + UI list keys. */
  scopeId: string;
  /** Free-form label used by the UI. Optional — the manager defaults
   *  to something readable. */
  label?: string;
  /** Optional source synth bundled with this scope's lifecycle. When
   *  set, `start()` /s_new's a tone whose output is wired to
   *  `inputBus`, so a freshly-added scope shows a recognisable signal
   *  with no extra wiring on the caller side. `stop()` frees it. */
  source?: ScopeSourceSpec;
}

export class ScopeController {
  readonly scopeId: string;
  readonly label: string;
  readonly channels: 1 | 2;
  readonly inputBus: number;
  readonly source: ScopeSourceSpec | null;

  /** Mutable single-slot ref consumed by `ScopeView`'s RAF loop. The
   *  draw routine reads `.current` once per frame; older frames are
   *  overwritten as new chunks arrive. */
  readonly chunkRef: { current: ScopeChunk | null } = { current: null };

  private readonly client: WorkerClient;
  private readonly clock: ClockController;
  private readonly group: GroupController;
  private readonly registry: SynthDefRegistry;
  private readonly nodeIds: IdAllocator;
  private readonly bufferIds: IdAllocator;

  private readonly latestChunkStore = createStore<ScopeChunk | null>(null);
  private readonly chunksPerSecStore = createStore<number>(0);
  /** Sliding 1-second window of chunk-arrival timestamps used to derive
   *  `chunksPerSec`. Kept on the instance so `start` / `stop` can
   *  reset it cleanly. */
  private recentArrivals: number[] = [];

  private scopeNodeId: number | null = null;
  private sourceNodeId: number | null = null;
  private bufnum: number | null = null;
  private unsubscribe: (() => void) | null = null;
  private skipNext = false;
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
    this.source = opts.source ?? null;
  }

  /** Latest chunk seen by the subscription. Useful for stats / non-RAF
   *  consumers; the canvas reads `chunkRef` directly. */
  get latestChunk(): ReadonlyStore<ScopeChunk | null> {
    return this.latestChunkStore;
  }

  /** Rolling 1-second chunk arrival rate. Approximately `tickRate` once
   *  the subscription is healthy. */
  get chunksPerSec(): ReadonlyStore<number> {
    return this.chunksPerSecStore;
  }

  /** Bring up the scope: load defs, start optional source, allocate
   *  buffer, /s_new the scope, register the subscription. Idempotent. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    if (this.source) {
      await this.startSource();
    }

    const synthName = scopeSynthDefName(this.channels);
    await this.registry.ensureLoaded(
      synthName,
      compileScopeSynthDef(this.channels),
    );

    const bufnum = this.bufferIds.next();
    // bAlloc takes (bufnum, numFrames, numChannels). For multi-channel
    // scopes the buffer holds N samples × C channels interleaved, so
    // numFrames stays SCOPE_RING — scsynth multiplies by numChannels.
    await this.client.sendAndSync(bAlloc(bufnum, SCOPE_RING, this.channels));
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

    this.skipNext = true;
    this.unsubscribe = this.client.subscribeScope(
      {
        scopeId: this.scopeId,
        bufnum,
        chunkSize: DEFAULT_PARAMS.scopeChunkSize,
        channels: this.channels,
      },
      (chunk) => this.handleChunk(chunk),
    );
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
    if (this.sourceNodeId !== null) {
      try {
        await this.client.sendAndSync(nFree(this.sourceNodeId));
      } catch (err) {
        console.warn(`[sc:scope ${this.scopeId}] source nFree failed`, err);
      }
      this.sourceNodeId = null;
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

  private async startSource(): Promise<void> {
    if (!this.source) return;
    if (this.source.kind === 'mono') {
      await this.registry.ensureLoaded(
        TEST_TONE_SYNTHDEF_NAME,
        compileTestToneSynthDef(),
      );
      const nodeId = this.nodeIds.next();
      await this.client.sendAndSync(
        sNew(TEST_TONE_SYNTHDEF_NAME, nodeId, AddToTail, this.group.groupId, {
          outBus: this.inputBus,
          freq: this.source.freq,
          amp: this.source.amp ?? DEFAULT_TONE_AMP,
        }),
      );
      this.sourceNodeId = nodeId;
      return;
    }
    // stereo
    await this.registry.ensureLoaded(
      TEST_TONE_STEREO_SYNTHDEF_NAME,
      compileTestToneStereoSynthDef(),
    );
    const nodeId = this.nodeIds.next();
    await this.client.sendAndSync(
      sNew(
        TEST_TONE_STEREO_SYNTHDEF_NAME,
        nodeId,
        AddToTail,
        this.group.groupId,
        {
          outBus: this.inputBus,
          freqL: this.source.freqL,
          freqR: this.source.freqR,
          amp: this.source.amp ?? DEFAULT_TONE_AMP,
        },
      ),
    );
    this.sourceNodeId = nodeId;
  }

  private handleChunk(chunk: ScopeChunk): void {
    if (this.skipNext) {
      this.skipNext = false;
      return;
    }
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
