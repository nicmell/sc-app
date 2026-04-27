/**
 * One scope instance — a thin consumer that subscribes to a shared
 * `BufferHandle` and renders the chunk stream via `ScopeView`.
 *
 * Phase 19 retired the per-scope `/b_alloc` + `/s_new` + worker
 * subscription: that infrastructure now lives in `BufferController`,
 * ref-counted by `BufferManager`. Two scopes on the same
 * `(inputBus, channels, chunkSize)` triple share one underlying
 * tap synth + buffer; this controller doesn't know or care.
 *
 * Contract with `BufferHandle`: every chunk's `data` Float32Array
 * is shared by reference across all consumers — read-only, must not
 * be retained beyond the current tick. The render loop in
 * `ScopeView` reads `chunkRef.current` once per RAF frame and
 * traces over it; it never mutates and the ref is overwritten by
 * each new chunk so no retention occurs.
 */

import type { BufferHandle } from '@/buffer/BufferController';
import type { BufferChunk } from '@/server/workerProtocol';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';

export interface ScopeControllerOptions {
  /** Shared buffer handle from `BufferManager.acquire`. The scope
   *  decrements its refcount via `buffer.release()` in `stop()`. */
  buffer: BufferHandle;
  /** Stable id for UI list keys. */
  scopeId: string;
  label?: string;
  /** Effective audio rate this scope produces (= clock's
   *  sampleRate). Used by `ScopeView` for the visible-window
   *  millisecond readout. */
  effectiveRate: number;
}

export class ScopeController {
  readonly scopeId: string;
  readonly label: string;
  readonly inputBus: number;
  readonly channels: number;
  /** Samples per chunk = `clock.derived.samplesPerTick` at the time
   *  the buffer handle was acquired. Mirrored from `buffer.spec`
   *  for `ScopeView`. */
  readonly samplesPerChunk: number;
  readonly effectiveRate: number;

  /** Mutable single-slot ref consumed by `ScopeView`'s RAF loop.
   *  The draw routine reads `.current` once per frame; older
   *  frames are overwritten as new chunks arrive. */
  readonly chunkRef: { current: BufferChunk | null } = { current: null };

  private readonly buffer: BufferHandle;

  private readonly latestChunkStore = createStore<BufferChunk | null>(null);
  private readonly chunksPerSecStore = createStore<number>(0);
  /** Sliding 1-second window of chunk-arrival timestamps. */
  private recentArrivals: number[] = [];

  private unsubscribeChunks: (() => void) | null = null;
  private started = false;
  private released = false;

  constructor(opts: ScopeControllerOptions) {
    this.buffer = opts.buffer;
    this.scopeId = opts.scopeId;
    this.label = opts.label ?? `scope ${opts.scopeId.slice(0, 6)}`;
    this.inputBus = opts.buffer.spec.inputBus;
    this.channels = opts.buffer.spec.channels;
    this.samplesPerChunk = opts.buffer.spec.chunkSize;
    this.effectiveRate = opts.effectiveRate;
  }

  /** Latest chunk seen by the subscription. Useful for stats /
   *  non-RAF consumers; the canvas reads `chunkRef` directly. */
  get latestChunk(): ReadonlyStore<BufferChunk | null> {
    return this.latestChunkStore;
  }

  /** Rolling 1-second chunk arrival rate. Approximately `tickRate`
   *  once the subscription is healthy. */
  get chunksPerSec(): ReadonlyStore<number> {
    return this.chunksPerSecStore;
  }

  /** Subscribe to the buffer's chunk stream. Idempotent. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.unsubscribeChunks = this.buffer.subscribe((chunk) =>
      this.handleChunk(chunk),
    );
  }

  /** Drop the chunk subscription and release the buffer handle.
   *  Last-release on the underlying `BufferController` triggers
   *  /n_free + /b_free on the tap synth + buffer. Idempotent. */
  async stop(): Promise<void> {
    if (this.released) return;
    this.released = true;

    if (this.unsubscribeChunks) {
      this.unsubscribeChunks();
      this.unsubscribeChunks = null;
    }
    this.chunkRef.current = null;
    this.latestChunkStore.set(null);
    this.chunksPerSecStore.set(0);
    this.recentArrivals = [];

    await this.buffer.release();
  }

  // ── Internals ─────────────────────────────────────────────────────

  private handleChunk(chunk: BufferChunk): void {
    // Scopes ignore `chunk.isGap` — a gap is rendered as silence,
    // which is exactly what the worker's zero-fill draws.
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
