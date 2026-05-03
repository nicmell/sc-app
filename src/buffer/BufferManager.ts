/**
 * Ref-counted owner of `BufferController`s, keyed by
 * `(inputBus, channels, chunkSize)`. The single producer of tap-synth
 * `/s_new` (post-Phase-31, with `ScopeOut2` writing to a sclang-
 * allocated scope_buffer index) for the consumer side; scopes and
 * recordings acquire / release handles instead of allocating their own.
 *
 * Sharing semantics: two consumers with the same spec share one
 * controller and one handle's-worth of refcount each. The first
 * acquire pays the round-trip; subsequent ones return immediately.
 * The last release tears down the tap synth + frees the scope_buffer
 * index.
 *
 * Phase 31: SHM availability is probed once at construction (via
 * `GET /api/scope/probe`). If unavailable (remote scsynth, exotic
 * deployment), `acquire()` rejects immediately with a clear error
 * — there is no OSC `/b_getn` fallback path post-31.
 */

import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import {
  BufferController,
  type BufferControllerOptions,
  type BufferHandle,
  type BufferSpec,
} from './BufferController';
import { probeScopeShm, type ScopeShmProbe } from '@/scope/scopeClient';
import type { GroupController } from '@/server/GroupController';
import type { IdAllocator } from '@/server/IdAllocator';
import type { SynthDefRegistry } from '@/server/SynthDefRegistry';
import type { WorkerClient } from '@/server/WorkerClient';

export interface BufferManagerOptions {
  client: WorkerClient;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator };
}

/** One row in the debug snapshot store. `scopeNum` / `nodeId` are
 *  read at snapshot-emission time — they're non-null between a
 *  successful `start()` and `dispose()`. */
export interface BufferSnapshot {
  key: string;
  spec: BufferSpec;
  refcount: number;
  scopeNum: number | null;
  nodeId: number | null;
  bufferId: string;
}

interface Entry {
  ctrl: BufferController;
  refcount: number;
}

/** Defensive ceiling on `acquire()`'s wait. `BufferController.start()`
 *  awaits two `sendAndSync` calls, each with `WorkerClient`'s own 2 s
 *  per-call timeout, plus a synchronous `subscribeBuffer` postMessage
 *  — so the realistic worst case is ~5 s. The 10 s ceiling here is
 *  defence-in-depth: if some future change introduces a hang path
 *  that escapes the per-call timeout, this prevents the in-flight
 *  Promise cache from deadlocking every subsequent
 *  `acquire(sameSpec)` joined to it. */
const ACQUIRE_TIMEOUT_MS = 10_000;

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
  /** Phase 31: SHM availability bit, populated by a one-shot
   *  `GET /api/scope/probe` lazily on first `acquire()`. Cached
   *  per-instance — re-probing on every acquire is wasteful, and
   *  scsynth-locality doesn't change mid-session. */
  private shmProbe: ScopeShmProbe | null = null;

  constructor(opts: BufferManagerOptions) {
    this.opts = opts;
  }

  /** Live debug surface — one row per active buffer with its key,
   *  spec, refcount, and (current) scopeNum / nodeId. Foundation
   *  for a future `BuffersPanel`; also catches refcount leaks
   *  visibly during normal operation rather than only at teardown. */
  get snapshot(): ReadonlyStore<BufferSnapshot[]> {
    return this.snapshotStore;
  }

  /** Get a handle to a buffer matching `spec`, allocating if none
   *  exists. The first acquire pays a `/scope/allocate` + `/s_new`
   *  + `/sync` round-trip; subsequent acquires on the same spec
   *  return immediately with a fresh handle wrapper.
   *
   *  Phase 31: rejects immediately if the bridge's SHM probe says
   *  scsynth's scope_buffer pool isn't reachable (e.g. scsynth
   *  is on a different machine). All sc-app deployments colocate
   *  scsynth + bridge so this is normally a no-op gate.
   *
   *  Capped at `ACQUIRE_TIMEOUT_MS` per call. If the underlying
   *  `spinUp` resolves AFTER the caller's timeout fired, the
   *  resulting handle is released best-effort so the controller
   *  doesn't sit in the entries map unowned. */
  async acquire(spec: BufferSpec): Promise<BufferHandle> {
    validateSpec(spec);

    // Phase 31: SHM probe gate. Lazy + cached per-manager.
    if (this.shmProbe === null) {
      this.shmProbe = await probeScopeShm();
    }
    if (!this.shmProbe.available) {
      const detail = this.shmProbe.error ?? 'unknown reason';
      throw new Error(
        `BufferManager.acquire: SHM scope-buffer pool not available ` +
          `(${detail}). scsynth must be running on the same machine as ` +
          `the bridge for scopes/recordings to work.`,
      );
    }

    const key = keyOf(spec);

    const existing = this.entries.get(key);
    if (existing) {
      existing.refcount++;
      this.refreshSnapshot();
      return this.makeHandle(existing.ctrl, key);
    }

    const inflight = this.inflight.get(key);
    if (inflight) {
      // Caller joins an in-flight spinUp — they get their own
      // independent timeout race below.
      return this.raceWithTimeout(inflight, key);
    }

    const promise = this.spinUp(spec, key);
    this.inflight.set(key, promise);
    // Tie inflight cleanup to the spinUp's own settlement, NOT to
    // the caller's race outcome. If a caller times out mid-flight,
    // the spinUp is still running; subsequent `acquire(sameSpec)`
    // calls should be able to join it.
    void promise.finally(() => {
      this.inflight.delete(key);
    });

    return this.raceWithTimeout(promise, key);
  }

  /** Race `promise` against an `ACQUIRE_TIMEOUT_MS` timeout. If the
   *  timeout fires first, the caller sees a timeout error and a
   *  best-effort late-cleanup releases the handle if `spinUp`
   *  later resolves (so the entry doesn't sit in the map unowned).
   *  Each caller joining the same in-flight `spinUp` has its own
   *  independent timeout — slow-but-not-stuck spinUps don't
   *  cascade-fail every joined caller. */
  private raceWithTimeout(
    promise: Promise<BufferHandle>,
    key: string,
  ): Promise<BufferHandle> {
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true;
        reject(
          new Error(
            `BufferManager.acquire(${key}) timed out after ${ACQUIRE_TIMEOUT_MS}ms`,
          ),
        );
      }, ACQUIRE_TIMEOUT_MS);
    });

    // Late-cleanup: if `promise` resolves after this caller's
    // timeout, release the handle best-effort. Without this, a
    // late-resolving spinUp commits to entries with refcount 1
    // and no caller owns the release. The handle's internal
    // `released` guard makes this safe even if a later `acquire`
    // raced into the entries cache during the gap.
    void promise.then(
      (handle) => {
        if (timedOut) {
          handle.release().catch((err) => {
            console.warn(
              `[sc:buffer-manager] late spinUp(${key}) cleanup release failed`,
              err,
            );
          });
        }
      },
      () => {
        /* spinUp rejected — caller already saw its error or the timeout */
      },
    );

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timeoutId !== null) clearTimeout(timeoutId);
    });
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
        scopeNum: ctrl.scopeNum.get(),
        nodeId: ctrl.nodeId.get(),
        bufferId: ctrl.bufferId,
      })),
    );
  }
}
