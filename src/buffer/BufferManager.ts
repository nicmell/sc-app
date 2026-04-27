/**
 * Ref-counted owner of `BufferController`s, keyed by
 * `(inputBus, channels, chunkSize)`. The single producer of `/b_alloc`
 * + tap-synth `/s_new` for the consumer side; scopes and recordings
 * acquire / release handles instead of allocating their own.
 *
 * Sharing semantics: two consumers with the same spec share one
 * controller and one handle's-worth of refcount each. The first
 * acquire pays the round-trip; subsequent ones return immediately.
 * The last release tears down the tap synth + buffer.
 *
 * Phase 16 scope: scaffolding only. `BufferManager` is not yet
 * constructed by `AppShell`; the running app continues to use
 * `ScopeManager` / `RecordingManager`'s per-consumer buffer paths.
 * Phase 19 / 20 migrate the consumers; Phase 21 wires this into
 * `setupDashboard` / `teardownServerState`.
 */

import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import {
  BufferController,
  type BufferControllerOptions,
  type BufferHandle,
  type BufferSpec,
} from './BufferController';
import type { ClockController } from '@/clock/ClockController';
import type { GroupController } from '@/server/GroupController';
import type { IdAllocator } from '@/server/IdAllocator';
import type { SynthDefRegistry } from '@/server/SynthDefRegistry';
import type { WorkerClient } from '@/server/WorkerClient';

export interface BufferManagerOptions {
  client: WorkerClient;
  clock: ClockController;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator; buffer: IdAllocator };
}

/** One row in the debug snapshot store. `bufnum` / `nodeId` are
 *  read at snapshot-emission time — they're non-null between a
 *  successful `start()` and `dispose()`. */
export interface BufferSnapshot {
  key: string;
  spec: BufferSpec;
  refcount: number;
  bufnum: number | null;
  nodeId: number | null;
  bufferId: string;
}

interface Entry {
  ctrl: BufferController;
  refcount: number;
}

function keyOf(spec: BufferSpec): string {
  return `${spec.inputBus}:${spec.channels}:${spec.chunkSize}`;
}

function freshBufferId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `buf-${Math.random().toString(36).slice(2, 10)}`;
}

function validateSpec(spec: BufferSpec): void {
  if (!Number.isInteger(spec.inputBus) || spec.inputBus < 0) {
    throw new Error(
      `BufferManager: spec.inputBus must be a non-negative integer, got ${spec.inputBus}`,
    );
  }
  if (!Number.isInteger(spec.channels) || spec.channels < 1) {
    throw new Error(
      `BufferManager: spec.channels must be a positive integer, got ${spec.channels}`,
    );
  }
  if (!Number.isInteger(spec.chunkSize) || spec.chunkSize < 1) {
    throw new Error(
      `BufferManager: spec.chunkSize must be a positive integer, got ${spec.chunkSize}`,
    );
  }
}

export class BufferManager {
  private readonly opts: BufferManagerOptions;
  private readonly entries = new Map<string, Entry>();
  /** In-flight acquire deduplication: a parallel `acquire(sameSpec)`
   *  arriving while the first is still awaiting `start()` waits on
   *  the same Promise instead of double-allocating a buffer + tap. */
  private readonly inflight = new Map<string, Promise<BufferHandle>>();
  private readonly snapshotStore = createStore<BufferSnapshot[]>([]);

  constructor(opts: BufferManagerOptions) {
    this.opts = opts;
  }

  /** Live debug surface — one row per active buffer with its key,
   *  spec, refcount, and (current) bufnum / nodeId. Foundation for a
   *  future `BuffersPanel`; also catches refcount leaks visibly
   *  during normal operation rather than only at teardown. */
  get snapshot(): ReadonlyStore<BufferSnapshot[]> {
    return this.snapshotStore;
  }

  /** Get a handle to a buffer matching `spec`, allocating if none
   *  exists. The first acquire pays a `/b_alloc` + `/s_new` +
   *  `/sync` round-trip; subsequent acquires on the same spec
   *  return immediately with a fresh handle wrapper. */
  async acquire(spec: BufferSpec): Promise<BufferHandle> {
    validateSpec(spec);
    const key = keyOf(spec);

    const existing = this.entries.get(key);
    if (existing) {
      existing.refcount++;
      this.refreshSnapshot();
      return this.makeHandle(existing.ctrl, key);
    }

    const inflight = this.inflight.get(key);
    if (inflight) return inflight;

    const promise = this.spinUp(spec, key);
    this.inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }

  /** Tear down every active buffer. Used by `teardownServerState`
   *  as a safety net — by the time it runs, every consumer should
   *  already have released its handle, so this should find an
   *  empty map. A non-empty map indicates a refcount leak; logged
   *  as a warning so the regression surfaces during development. */
  async clear(): Promise<void> {
    const list = [...this.entries.values()];
    if (list.length > 0) {
      console.warn(
        `[sc:buffer-manager] clear() found ${list.length} live buffers — refcount leak suspected. Disposing all.`,
      );
    }
    this.entries.clear();
    this.refreshSnapshot();
    await Promise.all(
      list.map(async ({ ctrl }) => {
        try {
          await ctrl.dispose();
        } catch (err) {
          console.warn(
            `[sc:buffer-manager] dispose ${ctrl.bufferId} failed`,
            err,
          );
        }
      }),
    );
  }

  // ── Internals ─────────────────────────────────────────────────────

  private async spinUp(spec: BufferSpec, key: string): Promise<BufferHandle> {
    const bufferId = freshBufferId();
    const ctrlOpts: BufferControllerOptions = {
      client: this.opts.client,
      clock: this.opts.clock,
      group: this.opts.group,
      registry: this.opts.registry,
      ids: this.opts.ids,
      spec,
      bufferId,
    };
    const ctrl = new BufferController(ctrlOpts);
    await ctrl.start();
    // INSERT AFTER `start()` RESOLVES. Inserting before would let a
    // parallel `acquire(sameSpec)` find the half-built entry and
    // refcount against it, handing consumers a handle to a buffer
    // that may never come up. The in-flight Promise cache (above)
    // handles legitimate concurrent `acquire`s by routing them to
    // the same Promise; this post-`start()` insert closes the race
    // for the failure path — a `start()` rejection leaves the map
    // untouched, and the rejected `acquire` callers see a clean
    // error.
    this.entries.set(key, { ctrl, refcount: 1 });
    this.refreshSnapshot();
    return this.makeHandle(ctrl, key);
  }

  private makeHandle(ctrl: BufferController, key: string): BufferHandle {
    let released = false;
    return {
      spec: ctrl.spec,
      bufferId: ctrl.bufferId,
      latestChunk: ctrl.latestChunk,
      subscribe: (cb) => ctrl.subscribe(cb),
      release: async () => {
        if (released) return;
        released = true;
        await this.releaseKey(key);
      },
    };
  }

  private async releaseKey(key: string): Promise<void> {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refcount--;
    if (entry.refcount > 0) {
      this.refreshSnapshot();
      return;
    }
    this.entries.delete(key);
    try {
      await entry.ctrl.dispose();
    } finally {
      this.refreshSnapshot();
    }
  }

  private refreshSnapshot(): void {
    this.snapshotStore.set(
      [...this.entries.entries()].map(([key, { ctrl, refcount }]) => ({
        key,
        spec: ctrl.spec,
        refcount,
        bufnum: ctrl.bufnum.get(),
        nodeId: ctrl.nodeId.get(),
        bufferId: ctrl.bufferId,
      })),
    );
  }
}
