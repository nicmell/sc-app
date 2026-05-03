/**
 * One shared tap synth + (Phase 31) scope-buffer subscription,
 * ref-counted by `BufferManager` and consumed by N scopes /
 * recorders / future analyzers reading the same
 * `(inputBus, channels, chunkSize)` triple.
 *
 * Producer / consumer split (unchanged from pre-31):
 *   - Producer = a synth (typically from `SynthsPanel`) writes
 *     audio onto `spec.inputBus`.
 *   - Tap synth = this controller's `/s_new` reads that bus and
 *     forwards it to a scope_buffer slot via `ScopeOut2`. Added
 *     `AddToTail` so it runs after the producer in the same
 *     control block.
 *   - Consumers = scopes / recorders subscribe to chunk delivery
 *     via `subscribe(cb)` (push) or `latestChunk` (pull), both
 *     exposed through the `BufferHandle` returned from
 *     `BufferManager.acquire`.
 *
 * Phase 31 lifecycle on `start()`:
 *   1. `/scope/allocate` round-trip → sclang returns a scope buffer
 *      index from `s.scopeBufferAllocator`.
 *   2. Compile-and-load the (channels, chunkSize)-keyed tap SynthDef
 *      via `SynthDefRegistry`.
 *   3. `/s_new` the tap with `scopeNum = <allocated>` — ScopeOut2
 *      writes input audio into the SHM scope_buffer slot for that
 *      index, every audio block.
 *   4. `WorkerClient.subscribeBuffer({ bufferId, scopeNum, ... })`
 *      registers the subscription; the bridge mmaps SHM and pushes
 *      `bufferChunk` events to main on every observed `/clock/tick`.
 *
 * On `dispose()`: unsubscribe → `/n_free` → `/scope/free <idx>`.
 * No `/b_alloc` / `/b_free`; no client-side `bufnum` allocator —
 * scope buffers are 0..127 globally, owned by sclang.
 *
 * This controller is owned exclusively by `BufferManager`. Direct
 * instantiation from consumers is a programming error — go
 * through `BufferManager.acquire`.
 */

import { AddToTail, bAlloc, bFree, nFree, sNew } from '@sc-app/server-commands';
import {
  bufferTapSynthDefName,
  compileBufferTapSynthDef,
} from '@/synthdefs/bufferTapSynthDef';
import {
  bufferTapOscSynthDefName,
  compileBufferTapOscSynthDef,
} from '@/synthdefs/bufferTapOscSynthDef';
import {
  SCOPE_ALLOCATED_REPLY,
  SCOPE_ALLOCATE_FAILED_REPLY,
  type ScopeMode,
  parseScopeAllocateFailed,
  parseScopeAllocated,
  scopeAllocate,
  scopeFree,
} from '@/scope/scopeClient';
import type { ClockController } from '@/clock/ClockController';
import type { GroupController } from '@/server/GroupController';
import type { IdAllocator } from '@/server/IdAllocator';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import type { SynthDefRegistry } from '@/server/SynthDefRegistry';
import type { WorkerClient } from '@/server/WorkerClient';
import type { BufferChunk } from '@/server/workerProtocol';

export type { BufferChunk };

/** Sharing key for `BufferManager`: any two consumers with the same
 *  `(inputBus, channels, chunkSize)` triple share one underlying
 *  tap synth + scope buffer index. `channels` is a positive
 *  integer with no upper bound — multichannel buses are
 *  first-class. */
export interface BufferSpec {
  inputBus: number;
  channels: number;
  chunkSize: number;
}

/** Read-only consumer-facing surface of a `BufferController`.
 *  Returned from `BufferManager.acquire`. Each `acquire` call gets
 *  a fresh handle wrapper (so double-`release` is safe and the
 *  refcount stays correct); the underlying controller is shared. */
export interface BufferHandle {
  readonly spec: BufferSpec;
  readonly bufferId: string;
  /** Pull-mode: latest chunk delivered, or `null` until the first
   *  one arrives. Renderers (e.g. `ScopeView`) read this on each
   *  RAF frame and draw whatever's current — older chunks are
   *  silently overwritten. */
  readonly latestChunk: ReadonlyStore<BufferChunk | null>;
  /** Push-mode: callback fires once per chunk in arrival order.
   *  Use this when you need every chunk (recordings); use
   *  `latestChunk` when you just want the freshest one (scopes).
   *  Returns an unsubscribe function. */
  subscribe(cb: (chunk: BufferChunk) => void): () => void;
  /** Decrement the buffer's refcount. Idempotent — calling more
   *  than once on the same handle is a silent no-op. The refcount
   *  hitting zero triggers tap-synth + scope-buffer teardown. */
  release(): Promise<void>;
}

export interface BufferControllerOptions {
  client: WorkerClient;
  group: GroupController;
  registry: SynthDefRegistry;
  /** Phase 36: SHM mode uses only `node`; OSC mode also uses
   *  `buffer` to allocate `/b_alloc`'d buffers. Both allocators
   *  are passed unconditionally — costs nothing if unused. */
  ids: { node: IdAllocator; buffer: IdAllocator };
  spec: BufferSpec;
  bufferId: string;
  /** Phase 36: scope-data path the bridge uses. Picked from
   *  `/api/scope/probe`'s `mode` field at session bootstrap. */
  mode: ScopeMode;
  /** Phase 36: clock controller. SHM mode unused; OSC mode reads
   *  `clockBus` from `info` to wire into the BufWr tap synth. */
  clock: ClockController;
}

/** Default `/scope/allocate` round-trip timeout. sclang's responder
 *  is synchronous (a single `s.scopeBufferAllocator.alloc` call) so
 *  the actual round-trip is sub-millisecond on localhost; this is
 *  generous headroom for unusual cases. */
const SCOPE_ALLOC_TIMEOUT_MS = 2000;

export class BufferController {
  readonly bufferId: string;
  readonly spec: BufferSpec;

  private readonly client: WorkerClient;
  private readonly group: GroupController;
  private readonly registry: SynthDefRegistry;
  private readonly nodeIds: IdAllocator;
  private readonly bufferIds: IdAllocator;
  private readonly mode: ScopeMode;
  private readonly clock: ClockController;

  /** SHM mode: scope buffer index from `/scope/allocate`.
   *  OSC mode: bufnum from `/b_alloc`. Same store, different
   *  meaning — `BufferManager.snapshot` reads it for debug
   *  visibility regardless of mode. */
  private readonly scopeNumStore = createStore<number | null>(null);
  private readonly nodeIdStore = createStore<number | null>(null);
  private readonly latestChunkStore = createStore<BufferChunk | null>(null);

  private readonly subscribers = new Set<(chunk: BufferChunk) => void>();

  /** Worker-subscription unsubscribe handle. Set during `start()`
   *  after the mode-specific allocation + `/s_new` resolve;
   *  cleared in `dispose()`. */
  private workerUnsubscribe: (() => void) | null = null;

  private started = false;
  private disposed = false;

  constructor(opts: BufferControllerOptions) {
    this.client = opts.client;
    this.group = opts.group;
    this.registry = opts.registry;
    this.nodeIds = opts.ids.node;
    this.bufferIds = opts.ids.buffer;
    this.spec = opts.spec;
    this.bufferId = opts.bufferId;
    this.mode = opts.mode;
    this.clock = opts.clock;
  }

  /** Read-only view of the current scope buffer index, or `null`
   *  when not running. Read by `BufferManager.snapshot` for debug
   *  visibility. */
  get scopeNum(): ReadonlyStore<number | null> {
    return this.scopeNumStore;
  }

  /** Read-only view of the current scsynth nodeId of the tap
   *  synth, or `null` when not running. */
  get nodeId(): ReadonlyStore<number | null> {
    return this.nodeIdStore;
  }

  get latestChunk(): ReadonlyStore<BufferChunk | null> {
    return this.latestChunkStore;
  }

  /** Allocate a buffer (mode-dependent), /s_new the tap synth,
   *  and register a worker subscription. Idempotent. Throws on
   *  partial failure; the catch-block calls `dispose()` so any
   *  allocation that succeeded before a later step failed is
   *  cleaned up uniformly. */
  async start(): Promise<void> {
    if (this.started) return;
    try {
      if (this.mode === 'shm') {
        await this.startShm();
      } else {
        await this.startOsc();
      }
      this.started = true;
    } catch (err) {
      // SINGLE CLEANUP PATH. `dispose()` is null-safe across every
      // partial state (no nodeId set yet, no buffer/scopeNum set
      // yet, etc.). Cleanup errors are swallowed so the original
      // failure — the meaningful one — is what propagates to the
      // caller.
      try {
        await this.dispose();
      } catch {
        /* swallow — original error wins */
      }
      throw err;
    }
  }

  /** Phase 31 SHM path. /scope/allocate → /s_new with ScopeOut2
   *  → worker subscribe. */
  private async startShm(): Promise<void> {
    const { channels, chunkSize, inputBus } = this.spec;

    // Ask sclang for a scope buffer index. sclang owns
    // `s.scopeBufferAllocator` (StackNumberAllocator(0, 127)).
    // Reply lands either on `/scope/allocated <idx>` (success)
    // or `/scope/allocateFailed <reason>` (allocator exhausted).
    const reply = await this.client.sendAndAwaitReply(
      scopeAllocate(),
      (r) =>
        r.address === SCOPE_ALLOCATED_REPLY ||
        r.address === SCOPE_ALLOCATE_FAILED_REPLY,
      SCOPE_ALLOC_TIMEOUT_MS,
    );
    if (reply.address === SCOPE_ALLOCATE_FAILED_REPLY) {
      const { reason } = parseScopeAllocateFailed(reply.args);
      throw new Error(`scope buffer allocation failed: ${reason}`);
    }
    const { index: scopeNum } = parseScopeAllocated(reply.args);
    this.scopeNumStore.set(scopeNum);

    const synthName = bufferTapSynthDefName(channels, chunkSize);
    await this.registry.ensureLoaded(
      synthName,
      compileBufferTapSynthDef(channels, chunkSize),
    );

    const nodeId = this.nodeIds.next();
    await this.client.sendAndSync(
      sNew(synthName, nodeId, AddToTail, this.group.groupId, {
        inBus: inputBus,
        scopeNum,
      }),
    );
    this.nodeIdStore.set(nodeId);

    // Bridge mmaps scsynth's scope_buffer SHM segment, polls on
    // every observed `/clock/tick`, emits `bufferChunk` events.
    const handle = this.client.subscribeBuffer(
      {
        bufferId: this.bufferId,
        scopeNum,
        channels,
        chunkSize,
      },
      (chunk) => this.deliverChunk(chunk),
    );
    this.workerUnsubscribe = handle.unsubscribe;
  }

  /** Phase 36 OSC fallback path. /b_alloc a 2-half ring buffer
   *  → /s_new with BufWr-based tap reading clockBus → worker
   *  subscribe (bridge interprets the wire `scope` field as
   *  bufnum in OSC mode). */
  private async startOsc(): Promise<void> {
    const { channels, chunkSize, inputBus } = this.spec;
    const clockBus = this.clock.clockBus;

    const bufnum = this.bufferIds.next();
    // 2-half ring: 2 × chunkSize frames per channel. /b_alloc
    // takes (bufnum, numFrames, numChannels). scsynth replies
    // /done /b_alloc <bufnum>; sendAndSync waits for /synced.
    await this.client.sendAndSync(bAlloc(bufnum, chunkSize * 2, channels));
    this.scopeNumStore.set(bufnum);

    const synthName = bufferTapOscSynthDefName(channels, chunkSize);
    await this.registry.ensureLoaded(
      synthName,
      compileBufferTapOscSynthDef(channels, chunkSize),
    );

    const nodeId = this.nodeIds.next();
    await this.client.sendAndSync(
      sNew(synthName, nodeId, AddToTail, this.group.groupId, {
        inBus: inputBus,
        bufnum,
        clockBus,
      }),
    );
    this.nodeIdStore.set(nodeId);

    // Wire `scopeNum: bufnum` — the bridge interprets that field
    // as a bufnum in OSC mode (Session.scope_mode === 'osc').
    const handle = this.client.subscribeBuffer(
      {
        bufferId: this.bufferId,
        scopeNum: bufnum,
        channels,
        chunkSize,
      },
      (chunk) => this.deliverChunk(chunk),
    );
    this.workerUnsubscribe = handle.unsubscribe;
  }

  /** Tear down everything `start()` allocated. Null-safe and
   *  idempotent; handles every partial state. Safe to call from
   *  `start()`'s catch-block. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    // Unsubscribe FIRST so the bridge stops polling SHM for a
    // about-to-be-freed scope_buffer index.
    if (this.workerUnsubscribe) {
      this.workerUnsubscribe();
      this.workerUnsubscribe = null;
    }

    this.subscribers.clear();
    this.latestChunkStore.set(null);

    const nodeId = this.nodeIdStore.get();
    if (nodeId !== null) {
      this.nodeIdStore.set(null);
      try {
        await this.client.sendAndSync(nFree(nodeId));
      } catch (err) {
        console.warn(`[sc:buffer ${this.bufferId}] nFree failed`, err);
      }
    }

    const scopeNum = this.scopeNumStore.get();
    if (scopeNum !== null) {
      this.scopeNumStore.set(null);
      try {
        if (this.mode === 'shm') {
          // Fire-and-forget: sclang's `/scope/free` doesn't reply.
          this.client.sendCommand(scopeFree(scopeNum));
        } else {
          // /b_free emits /done /b_free; we don't need to await
          // it since we're tearing down. Fire-and-forget is fine.
          this.client.sendCommand(bFree(scopeNum));
        }
      } catch (err) {
        console.warn(
          `[sc:buffer ${this.bufferId}] buffer free send failed`,
          err,
        );
      }
    }
  }

  /** Add a push-mode subscriber. Returns an unsubscribe function.
   *  Exposed to consumers via `BufferHandle.subscribe`. */
  subscribe(cb: (chunk: BufferChunk) => void): () => void {
    if (this.disposed) {
      throw new Error(
        `BufferController(${this.bufferId}): subscribe on disposed controller`,
      );
    }
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  /** Worker chunk dispatch: called for every bridge-emitted
   *  `bufferChunk` event matching this `bufferId`. Updates the
   *  pull store and fans out to push subscribers in registration
   *  order. */
  deliverChunk(chunk: BufferChunk): void {
    if (this.disposed) return;
    this.latestChunkStore.set(chunk);
    // Snapshot the set so a subscriber that unsubscribes inside
    // its own callback doesn't mutate the iteration mid-flight.
    for (const cb of [...this.subscribers]) {
      try {
        cb(chunk);
      } catch (err) {
        console.warn(
          `[sc:buffer ${this.bufferId}] subscriber threw`,
          err,
        );
      }
    }
  }
}
