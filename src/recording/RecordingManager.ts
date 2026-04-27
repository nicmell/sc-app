/**
 * Multi-recording orchestrator. Owns the live list of
 * `RecordingController`s and acquires shared `BufferHandle`s from
 * `BufferManager` for each `add()`.
 *
 * Phase 20 retired the per-recording `/b_alloc` + `/s_new` +
 * worker subscription path: that infrastructure now lives in
 * `BufferController`, ref-counted by `BufferManager`. A recording
 * and a scope on the same `(inputBus, channels, chunkSize)` triple
 * now share one tap synth + one buffer; this manager doesn't
 * notice — it just hands controllers a `BufferHandle` and lets
 * the manager handle dedup.
 *
 * Stopped recordings stay in the list (their `state.get() ===
 * 'done'`) so the panel can still offer the Download button — the
 * user removes them explicitly.
 */

import type { BufferManager } from '@/buffer/BufferManager';
import type { ClockController } from '@/clock/ClockController';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import {
  RecordingController,
  type RecordingResult,
} from './RecordingController';

export interface RecordingManagerOptions {
  bufferManager: BufferManager;
  /** For `chunkSize` (= `clock.derived.samplesPerTick`) and
   *  `sampleRate` (stamped into WAV headers) at acquire time. */
  clock: ClockController;
}

export interface AddRecordingOptions {
  inputBus: number;
  channels: number;
  label?: string;
}

function freshRecordingId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `rec-${Math.random().toString(36).slice(2, 10)}`;
}

export class RecordingManager {
  private readonly bufferManager: BufferManager;
  private readonly clock: ClockController;

  private readonly recordingsStore = createStore<RecordingController[]>([]);

  constructor(opts: RecordingManagerOptions) {
    this.bufferManager = opts.bufferManager;
    this.clock = opts.clock;
  }

  get recordings(): ReadonlyStore<RecordingController[]> {
    return this.recordingsStore;
  }

  /** Acquire a shared buffer for the spec, wrap it in a
   *  `RecordingController`, start the WAV writer + chunk
   *  subscription. Resolves once the controller is in `recording`
   *  state — samples may not have started landing yet, especially
   *  if the buffer was just freshly allocated (first 2-3 chunks
   *  are pre-`/s_new` zeros). */
  async add(opts: AddRecordingOptions): Promise<RecordingController> {
    const recordingId = freshRecordingId();
    const handle = await this.bufferManager.acquire({
      inputBus: opts.inputBus,
      channels: opts.channels,
      chunkSize: this.clock.derived.samplesPerTick,
    });
    const ctrl = new RecordingController({
      buffer: handle,
      recordingId,
      label: opts.label,
      sampleRate: this.clock.env.sampleRate,
    });
    try {
      await ctrl.start();
    } catch (err) {
      // start() failure already cleans up the writer + subscription
      // but doesn't release the handle — do that here so the
      // refcount drops cleanly.
      try {
        await handle.release();
      } catch {
        /* swallow — original error wins */
      }
      throw err;
    }
    this.recordingsStore.update((list) => [...list, ctrl]);
    return ctrl;
  }

  /** Drop a (typically already-stopped) recording from the list.
   *  The controller's `result` Blob is released to GC if no other
   *  code retains it. */
  remove(recordingId: string): void {
    this.recordingsStore.update((list) =>
      list.filter((r) => r.recordingId !== recordingId),
    );
  }

  /** Stop every active recording and wait for each to finalise.
   *  Already-stopped controllers (state === 'done' / 'error') are
   *  returned with their cached result if any.
   *
   *  This is part of the disconnect cleanup chain — call it before
   *  freeing the parent group so each recording's buffer handle
   *  is released cleanly and the WAVs are still available in
   *  memory for the user to download afterwards. */
  async stopAll(): Promise<RecordingResult[]> {
    const list = this.recordingsStore.get();
    const settled = await Promise.all(
      list.map(async (ctrl) => {
        const state = ctrl.state.get();
        if (state === 'recording') {
          try {
            return await ctrl.stop();
          } catch (err) {
            console.warn(
              `[sc:rec-manager] stop ${ctrl.recordingId} failed`,
              err,
            );
            return null;
          }
        }
        return ctrl.result.get();
      }),
    );
    return settled.filter((r): r is RecordingResult => r !== null);
  }
}
