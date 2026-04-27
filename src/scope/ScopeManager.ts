/**
 * Multi-scope orchestrator. Owns the live list of `ScopeController`s
 * and acquires shared `BufferHandle`s from `BufferManager` on each
 * `add()`.
 *
 * Phase 19 simplified the manager dramatically: it no longer holds
 * `client` / `group` / `registry` / `ids` — those moved into
 * `BufferManager`. A scope is now strictly a chunk-stream consumer.
 * Two scopes added on the same `(inputBus, channels, chunkSize)`
 * triple share one tap synth + buffer; the manager / controller
 * pair never sees that — they just hand back a fresh handle wrapper
 * each time.
 */

import type { BufferManager } from '@/buffer/BufferManager';
import type { ClockController } from '@/clock/ClockController';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import { ScopeController } from './ScopeController';

export interface ScopeManagerOptions {
  bufferManager: BufferManager;
  /** For `chunkSize` (= `clock.derived.samplesPerTick`) and
   *  `sampleRate` (= `clock.env.sampleRate`) at acquire time. */
  clock: ClockController;
}

export interface AddScopeOptions {
  /** First audio bus index in the contiguous block to read. The
   *  user types this in the toolbar; typically copy-pasted from a
   *  Synths panel card. */
  inputBus: number;
  channels: number;
  label?: string;
}

function freshScopeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `scope-${Math.random().toString(36).slice(2, 10)}`;
}

export class ScopeManager {
  private readonly bufferManager: BufferManager;
  private readonly clock: ClockController;
  private readonly scopesStore = createStore<ScopeController[]>([]);

  constructor(opts: ScopeManagerOptions) {
    this.bufferManager = opts.bufferManager;
    this.clock = opts.clock;
  }

  /** Live list of running scopes. UI subscribes and re-renders on
   *  add / remove. */
  get scopes(): ReadonlyStore<ScopeController[]> {
    return this.scopesStore;
  }

  /** Acquire a shared buffer for the spec, wrap it in a
   *  `ScopeController`, start chunk subscription. */
  async add(opts: AddScopeOptions): Promise<ScopeController> {
    const scopeId = freshScopeId();
    const handle = await this.bufferManager.acquire({
      inputBus: opts.inputBus,
      channels: opts.channels,
      chunkSize: this.clock.derived.samplesPerTick,
    });
    const ctrl = new ScopeController({
      buffer: handle,
      scopeId,
      label: opts.label,
      effectiveRate: this.clock.env.sampleRate,
    });
    try {
      await ctrl.start();
    } catch (err) {
      // Best-effort: stop() releases the handle. Original error
      // propagates so the caller sees the meaningful failure.
      try {
        await ctrl.stop();
      } catch {
        /* swallow — original error wins */
      }
      throw err;
    }
    this.scopesStore.update((list) => [...list, ctrl]);
    return ctrl;
  }

  /** Stop and remove the matching scope. Silent no-op if not found
   *  (already removed elsewhere). Calls `ctrl.stop()` which
   *  releases the buffer handle — the buffer is torn down only when
   *  the last consumer releases it. */
  async remove(scopeId: string): Promise<void> {
    const ctrl = this.scopesStore.get().find((s) => s.scopeId === scopeId);
    if (!ctrl) return;
    try {
      await ctrl.stop();
    } finally {
      this.scopesStore.update((list) =>
        list.filter((s) => s.scopeId !== scopeId),
      );
    }
  }

  /** Stop every scope and empty the list. Run as part of the
   *  disconnect sequence before `bufferManager.clear()` — releases
   *  the handles so the buffer manager sees a clean shutdown. */
  async clear(): Promise<void> {
    const list = this.scopesStore.get();
    this.scopesStore.set([]);
    await Promise.all(
      list.map(async (ctrl) => {
        try {
          await ctrl.stop();
        } catch (err) {
          console.warn(`[sc:scope-manager] stop ${ctrl.scopeId} failed`, err);
        }
      }),
    );
  }
}
