/**
 * Per-recording lifecycle controller. A pure consumer of a shared
 * `BufferHandle` from `BufferManager` — owns no scsynth-side state
 * (no /b_alloc, no /s_new, no /n_free, no /b_free). Subscribes once
 * to the buffer's chunk stream and runs three things off each
 * delivered chunk:
 *
 *   1. `WavMemoryWriter.append(chunk.data)` — grows the in-memory
 *      WAV.
 *   2. `EnvelopeBuffer.append(tickIndex, data)` — accumulates the
 *      per-tick min/max envelope the panel renders. (Until Phase 20
 *      this lived in a separate "internal scope" with its own
 *      buffer + tap synth; now both consumers of the same chunk
 *      stream live here.)
 *   3. Gap accounting on `chunk.isGap === true` — appends a sidecar
 *      JSON entry recording the missing tick.
 *
 * On `stop()` the writer is finalised synchronously on main, the
 * subscription is dropped, and the buffer handle is released —
 * ref-count drops; if no other consumer is holding the same buffer
 * (a scope on the same bus, say) it tears down automatically.
 *
 * State machine (`idle` → `preparing` → `recording` → `finalizing`
 * → `done` / `error`) is preserved for the panel UI.
 */

import type { BufferHandle } from '@/buffer/BufferController';
import type { BufferChunk } from '@/server/workerProtocol';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import {
  EnvelopeBuffer,
  type EnvelopeBufferSnapshot,
} from './envelopeBuffer';
import { WavMemoryWriter } from './wavWriter';

export type RecordingState =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'finalizing'
  | 'done'
  | 'error';

export interface RecordingResult {
  /** Complete WAV file as a Blob, ready for download. */
  wavBlob: Blob;
  /** Sidecar `gaps.json` Blob — null when no gaps were logged. */
  gapsBlob: Blob | null;
  gaps: ReadonlyArray<{ tickIndex: number; framesMissing: number }>;
  totalFrames: number;
  durationSeconds: number;
  /** Suggested base filename (without extension). The panel adds
   *  `.wav` / `.gaps.json` as appropriate. */
  suggestedFilename: string;
}

export interface RecordingControllerOptions {
  /** Shared buffer handle from `BufferManager.acquire`. The
   *  recording decrements its refcount via `buffer.release()` in
   *  `stop()`. */
  buffer: BufferHandle;
  recordingId: string;
  label?: string;
  /** Sample rate stamped into the WAV header. Comes from
   *  `clock.env.sampleRate`. */
  sampleRate: number;
}

export class RecordingController {
  readonly recordingId: string;
  readonly label: string;
  readonly channels: number;
  readonly inputBus: number;

  private readonly buffer: BufferHandle;
  private readonly sampleRate: number;

  private readonly stateStore = createStore<RecordingState>('idle');
  private readonly framesWrittenStore = createStore<number>(0);
  private readonly gapsStore = createStore<
    ReadonlyArray<{ tickIndex: number; framesMissing: number }>
  >([]);
  private readonly resultStore = createStore<RecordingResult | null>(null);
  private readonly errorStore = createStore<string | null>(null);

  /** WAV writer — created in `start()`, finalised in `stop()`. */
  private writer: WavMemoryWriter | null = null;
  /** Mutable gap accumulator — updated when chunks with
   *  `isGap: true` arrive. Mirrored into `gapsStore` for the UI. */
  private readonly gapList: Array<{ tickIndex: number; framesMissing: number }> =
    [];
  private unsubscribeChunks: (() => void) | null = null;
  private startedAt: Date | null = null;

  /** Per-tick min/max envelope. Survives stop() so the panel can
   *  scroll the waveform after the recording is finalised. */
  private readonly envelopeBuffer: EnvelopeBuffer;
  private readonly envelopesStore = createStore<EnvelopeBufferSnapshot>({
    mins: [],
    maxs: [],
    firstTickIndex: -1,
    count: 0,
    channels: 1,
  });

  constructor(opts: RecordingControllerOptions) {
    this.buffer = opts.buffer;
    this.sampleRate = opts.sampleRate;
    this.recordingId = opts.recordingId;
    this.label = opts.label ?? `recording ${opts.recordingId.slice(0, 6)}`;
    this.inputBus = opts.buffer.spec.inputBus;
    this.channels = opts.buffer.spec.channels;
    this.envelopeBuffer = new EnvelopeBuffer(this.channels);
    this.envelopesStore.set(this.envelopeBuffer.snapshot());
  }

  get state(): ReadonlyStore<RecordingState> {
    return this.stateStore;
  }
  get framesWritten(): ReadonlyStore<number> {
    return this.framesWrittenStore;
  }
  get gaps(): ReadonlyStore<
    ReadonlyArray<{ tickIndex: number; framesMissing: number }>
  > {
    return this.gapsStore;
  }
  /** Populated once `stop()` has resolved; null while running. */
  get result(): ReadonlyStore<RecordingResult | null> {
    return this.resultStore;
  }
  /** Last error message, or null. Set when state transitions to 'error'. */
  get error(): ReadonlyStore<string | null> {
    return this.errorStore;
  }
  /** Per-tick envelope (min/max per channel) accumulated for the
   *  recording's lifetime. Updated as chunks land; persists after
   *  `stop()` so the panel can scroll the full history. */
  get envelopes(): ReadonlyStore<EnvelopeBufferSnapshot> {
    return this.envelopesStore;
  }

  /** Construct the WAV writer and subscribe to the buffer's chunk
   *  stream. Idempotent — safe to call once. */
  async start(): Promise<void> {
    if (this.stateStore.get() !== 'idle') {
      throw new Error(
        `RecordingController.start: invalid state ${this.stateStore.get()}`,
      );
    }
    this.stateStore.set('preparing');
    this.errorStore.set(null);
    this.startedAt = new Date();

    try {
      this.writer = new WavMemoryWriter({
        sampleRate: this.sampleRate,
        channels: this.channels,
      });
      this.unsubscribeChunks = this.buffer.subscribe((chunk) =>
        this.handleChunk(chunk),
      );
      this.stateStore.set('recording');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errorStore.set(msg);
      this.stateStore.set('error');
      if (this.unsubscribeChunks) {
        this.unsubscribeChunks();
        this.unsubscribeChunks = null;
      }
      this.writer = null;
      throw err;
    }
  }

  /** Drop the buffer subscription, finalise the WAV, release the
   *  buffer handle. The WAV result is cached on `result`; the
   *  Promise resolves with the same object. */
  async stop(): Promise<RecordingResult> {
    const state = this.stateStore.get();
    if (state === 'done') {
      const cached = this.resultStore.get();
      if (cached) return cached;
    }
    if (state !== 'recording') {
      throw new Error(`RecordingController.stop: invalid state ${state}`);
    }
    this.stateStore.set('finalizing');

    // Drop the subscription FIRST so any chunk landing in flight
    // is dropped at the WorkerClient fan-out before reaching
    // `handleChunk` and trying to append to a finalised writer.
    if (this.unsubscribeChunks) {
      this.unsubscribeChunks();
      this.unsubscribeChunks = null;
    }

    if (!this.writer) {
      throw new Error(
        `RecordingController.stop: writer missing — start() never completed`,
      );
    }
    const totalFrames = this.writer.framesWritten;
    const wav = this.writer.finalise();
    this.writer = null;

    // Release the buffer handle — refcount drops; if we were the
    // last consumer the BufferController disposes (/n_free + /b_free).
    // Fire-and-forget so finalisation doesn't block on the network.
    void this.buffer.release().catch((err) => {
      console.warn(
        `[sc:rec ${this.recordingId}] buffer.release failed`,
        err,
      );
    });

    const wavBlob = new Blob([wav], { type: 'audio/wav' });
    const gapsSnapshot = this.gapList.slice();
    const gapsJson =
      gapsSnapshot.length > 0
        ? JSON.stringify(
            { recordingId: this.recordingId, gaps: gapsSnapshot },
            null,
            2,
          )
        : '';
    const gapsBlob =
      gapsJson.length > 0
        ? new Blob([gapsJson], { type: 'application/json' })
        : null;

    const result: RecordingResult = {
      wavBlob,
      gapsBlob,
      gaps: gapsSnapshot,
      totalFrames,
      durationSeconds: totalFrames / this.sampleRate,
      suggestedFilename: this.deriveFilename(),
    };

    this.framesWrittenStore.set(totalFrames);
    this.gapsStore.set(gapsSnapshot);
    this.resultStore.set(result);
    this.stateStore.set('done');

    return result;
  }

  // ── Internals ─────────────────────────────────────────────────────

  private handleChunk(chunk: BufferChunk): void {
    if (!this.writer) return;
    // Three concurrent observers of the same chunk:
    //   1. WAV writer (full-rate samples, the recording's payload)
    //   2. Envelope buffer (per-tick min/max for the panel waveform)
    //   3. Gap accumulator (sidecar JSON, surfaced if any chunk
    //      came in as a worker-synthesized zero-fill)
    this.writer.append(chunk.data);
    this.framesWrittenStore.set(this.writer.framesWritten);

    this.envelopeBuffer.append(chunk.tickIndex, chunk.data);
    this.envelopesStore.set(this.envelopeBuffer.snapshot());

    if (chunk.isGap) {
      const framesMissing = chunk.data.length / chunk.channels;
      this.gapList.push({ tickIndex: chunk.tickIndex, framesMissing });
      this.gapsStore.set(this.gapList.slice());
    }
  }

  private deriveFilename(): string {
    const ts = (this.startedAt ?? new Date()).toISOString();
    // Replace ':' with '-' and drop the trailing fractional seconds /
    // 'Z' for filename ergonomics: 2026-04-25T13-22-04.
    const tsClean = ts.replace(/:/g, '-').replace(/\..*$/, '');
    return `recording-bus${this.inputBus}-${tsClean}`;
  }
}
