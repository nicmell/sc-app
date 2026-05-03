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

import { AddToTail, nFree, sNew } from '@sc-app/server-commands';
import {
  bufferTapSynthDefName,
  compileBufferTapSynthDef,
} from '@/synthdefs/bufferTapSynthDef';
import {
  SCOPE_ALLOCATED_REPLY,
  SCOPE_ALLOCATE_FAILED_REPLY,
  parseScopeAllocateFailed,
  parseScopeAllocated,
  scopeAllocate,
  scopeFree,
} from '@/scope/scopeClient';
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
  ids: { node: IdAllocator };
  spec: BufferSpec;
  bufferId: string;
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

  private readonly scopeNumStore = createStore<number | null>(null);
  private readonly nodeIdStore = createStore<number | null>(null);
  private readonly latestChunkStore = createStore<BufferChunk | null>(null);

  private readonly subscribers = new Set<(chunk: BufferChunk) => void>();

  /** Worker-subscription unsubscribe handle. Set during `start()`
   *  after `/scope/allocate` + `/s_new` resolve; cleared in
   *  `dispose()`. */
  private workerUnsubscribe: (() => void) | null = null;

  private started = false;
  private disposed = false;

  constructor(opts: BufferControllerOptions) {
    this.client = opts.client;
    this.group = opts.group;
    this.registry = opts.registry;
    this.nodeIds = opts.ids.node;
    this.spec = opts.spec;
    this.bufferId = opts.bufferId;
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

  /** Allocate a scope buffer index, /s_new the tap synth, and
   *  register a worker subscription. Idempotent. Throws on partial
   *  failure; the catch-block calls `dispose()` so any allocation
   *  that succeeded before a later step failed is cleaned up
   *  uniformly. */
  async start(): Promise<void> {
    if (this.started) return;
    try {
      const { channels, chunkSize, inputBus } = this.spec;

      // Phase 31: ask sclang for a scope buffer index. sclang owns
      // `s.scopeBufferAllocator` (StackNumberAllocator(0, 127)).
      // Reply lands either on `/scope/allocated <idx>` (success) or
      // `/scope/allocateFailed <reason>` (allocator exhausted).
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

      // Register the SHM-driven subscription. The bridge mmaps
      // scsynth's scope_buffer SHM segment, polls on every
      // observed `/clock/tick`, and emits `bufferChunk` events
      // back to main with the just-completed scope_buffer slot.
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

      this.started = true;
    } catch (err) {
      // SINGLE CLEANUP PATH. `dispose()` is null-safe across every
      // partial state (no nodeId set yet, no scopeNum set yet,
      // etc.). Cleanup errors are swallowed so the original
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
      // Fire-and-forget: sclang's `/scope/free` doesn't reply.
      try {
        this.client.sendCommand(scopeFree(scopeNum));
      } catch (err) {
        console.warn(
          `[sc:buffer ${this.bufferId}] scope/free send failed`,
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
