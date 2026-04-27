/**
 * One shared buffer + tap synth + (Phase-17) worker subscription,
 * ref-counted by `BufferManager` and consumed by N scopes /
 * recorders / future analyzers reading the same
 * `(inputBus, channels, chunkSize)` triple.
 *
 * Producer / consumer split:
 *   - Producer = a synth (typically from `SynthsPanel`) writes
 *     audio onto `spec.inputBus`.
 *   - Tap synth = this controller's `/s_new` reads that bus into
 *     the buffer (`AddToTail` so it runs after the producer in
 *     the same control block).
 *   - Consumers = scopes / recorders subscribe to chunk delivery
 *     via `subscribe(cb)` (push) or `latestChunk` (pull). Both
 *     APIs are exposed through the `BufferHandle` returned from
 *     `BufferManager.acquire`.
 *
 * Phase 16 scope: full lifecycle (`/b_alloc` + `/s_new` + `/sync`,
 * `/n_free` + `/b_free`) is implemented; worker chunk delivery is
 * stubbed pending the Phase 17 worker-subscription pivot. The
 * class is not yet referenced from `AppShell` so the missing
 * chunk path is inert until Phase 17 wires it up.
 *
 * This controller is owned exclusively by `BufferManager`. Direct
 * instantiation from consumers is a programming error — go
 * through `BufferManager.acquire`.
 */

import {
  AddToTail,
  bAlloc,
  bFree,
  nFree,
  sNew,
} from '@sc-app/server-commands';
import {
  bufferTapSynthDefName,
  compileBufferTapSynthDef,
} from '@/synthdefs/bufferTapSynthDef';
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
 *  tap synth + buffer. `channels` is a positive integer with no
 *  upper bound — multichannel buses are first-class. */
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
   *  hitting zero triggers tap-synth + buffer teardown. */
  release(): Promise<void>;
}

export interface BufferControllerOptions {
  client: WorkerClient;
  clock: ClockController;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator; buffer: IdAllocator };
  spec: BufferSpec;
  bufferId: string;
}

export class BufferController {
  readonly bufferId: string;
  readonly spec: BufferSpec;

  private readonly client: WorkerClient;
  private readonly clock: ClockController;
  private readonly group: GroupController;
  private readonly registry: SynthDefRegistry;
  private readonly nodeIds: IdAllocator;
  private readonly bufferIds: IdAllocator;

  private readonly bufnumStore = createStore<number | null>(null);
  private readonly nodeIdStore = createStore<number | null>(null);
  private readonly latestChunkStore = createStore<BufferChunk | null>(null);

  private readonly subscribers = new Set<(chunk: BufferChunk) => void>();

  private started = false;
  private disposed = false;

  constructor(opts: BufferControllerOptions) {
    this.client = opts.client;
    this.clock = opts.clock;
    this.group = opts.group;
    this.registry = opts.registry;
    this.nodeIds = opts.ids.node;
    this.bufferIds = opts.ids.buffer;
    this.spec = opts.spec;
    this.bufferId = opts.bufferId;
  }

  /** Read-only view of the current scsynth bufnum, or `null` when
   *  not running. Read by `BufferManager.snapshot` for debug
   *  visibility; not part of `BufferHandle`. */
  get bufnum(): ReadonlyStore<number | null> {
    return this.bufnumStore;
  }

  /** Read-only view of the current scsynth nodeId of the tap synth,
   *  or `null` when not running. */
  get nodeId(): ReadonlyStore<number | null> {
    return this.nodeIdStore;
  }

  get latestChunk(): ReadonlyStore<BufferChunk | null> {
    return this.latestChunkStore;
  }

  /** Allocate the buffer, /s_new the tap synth, and (Phase 17)
   *  register a worker subscription. Idempotent. Throws on partial
   *  failure; the catch-block calls `dispose()` so any /b_alloc
   *  that succeeded before the /s_new failed (or vice versa) is
   *  cleaned up uniformly. */
  async start(): Promise<void> {
    if (this.started) return;
    try {
      const { channels, chunkSize, inputBus } = this.spec;

      const synthName = bufferTapSynthDefName(channels, chunkSize);
      await this.registry.ensureLoaded(
        synthName,
        compileBufferTapSynthDef(channels, chunkSize),
      );

      const bufnum = this.bufferIds.next();
      // Two-half ring: tap alternates writing into half 0 then half
      // 1 each tick. Consumers read the just-completed half while
      // the next is being written. `bAlloc` takes frame count; total
      // size = `ringFrames × channels × 4 bytes`.
      const ringFrames = chunkSize * 2;
      await this.client.sendAndSync(bAlloc(bufnum, ringFrames, channels));
      this.bufnumStore.set(bufnum);

      const nodeId = this.nodeIds.next();
      await this.client.sendAndSync(
        sNew(synthName, nodeId, AddToTail, this.group.groupId, {
          inBus: inputBus,
          bufnum,
          clockBus: this.clock.clockBus,
        }),
      );
      this.nodeIdStore.set(nodeId);

      // TODO Phase 17: register worker subscription routing chunks
      // to `deliverChunk`. Until then the tap writes the buffer
      // every tick but no main-thread consumer sees anything.

      this.started = true;
    } catch (err) {
      // SINGLE CLEANUP PATH. `dispose()` is null-safe across every
      // partial state (no nodeId set yet, no bufnum set yet, etc.),
      // which is the entire reason this catch can route through one
      // function regardless of which step inside the try failed.
      // Cleanup errors are swallowed so the original failure — the
      // meaningful one — is what propagates to the caller.
      try {
        await this.dispose();
      } catch {
        /* swallow — original error wins */
      }
      throw err;
    }
  }

  /** Tear down everything `start()` allocated. Null-safe and
   *  idempotent; handles every partial state (no nodeId, no
   *  bufnum, /s_new failed mid-bundle, etc.). Safe to call from
   *  `start()`'s catch-block. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;

    this.subscribers.clear();
    this.latestChunkStore.set(null);

    // TODO Phase 17: unregister the worker subscription before
    //  freeing the node, so a late /b_setn reply doesn't try to
    //  route to a freed buffer.

    const nodeId = this.nodeIdStore.get();
    if (nodeId !== null) {
      this.nodeIdStore.set(null);
      try {
        await this.client.sendAndSync(nFree(nodeId));
      } catch (err) {
        console.warn(`[sc:buffer ${this.bufferId}] nFree failed`, err);
      }
    }

    const bufnum = this.bufnumStore.get();
    if (bufnum !== null) {
      this.bufnumStore.set(null);
      try {
        await this.client.sendAndSync(bFree(bufnum));
      } catch (err) {
        console.warn(`[sc:buffer ${this.bufferId}] bFree failed`, err);
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

  /** Integration seam for Phase 17: the worker chunk dispatch will
   *  call this for every delivered chunk. Updates the pull store
   *  and fans out to push subscribers in registration order. */
  deliverChunk(chunk: BufferChunk): void {
    if (this.disposed) return;
    this.latestChunkStore.set(chunk);
    // Snapshot the set so a subscriber that unsubscribes inside its
    // own callback doesn't mutate the iteration mid-flight.
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
