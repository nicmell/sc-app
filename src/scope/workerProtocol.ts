/**
 * Main ↔ worker protocol. The main thread constructs OSC packets
 * (`OSC.Message` / `OSC.Bundle`) locally, encodes them to bytes via
 * `@sc-app/server-commands`, and posts the bytes over to the worker.
 * The worker forwards bytes to the WebSocket bridge and decodes
 * inbound bytes back into plain `{ address, args }` POJOs for the
 * main thread to consume.
 *
 * Why POJOs on the return path: `postMessage` uses structured-clone,
 * which strips class prototypes. `OSC.Message` instances arrive on
 * the main thread as bare `{ address, args, types }` objects without
 * methods. We formalise that shape here rather than pretending it's
 * still an `OSC.Message`.
 */

import type { OscArg } from '@sc-app/server-commands';

/** Plain representation of an inbound OSC message as seen on the
 *  main thread after postMessage. Matches `OSC.Message`'s field
 *  shape (minus methods). */
export interface OscReply {
  address: string;
  args: ReadonlyArray<OscArg>;
}

/** One decoded clock tick. Emitted by the worker when a `/tr` reply
 *  arrives whose `triggerId` matches the currently-registered clock
 *  trigId. The generic `reply` event is suppressed for those messages. */
export interface ClockTick {
  /** Monotonic pulse count from the synth. */
  tickIndex: number;
  /** Worker-side `performance.now()` at decode time. Cross-thread clocks
   *  differ, so consumers that need freshness checks should stamp
   *  on the main thread. */
  receivedAt: number;
}

/** Per-scope subscription registered with the worker's tick-driven
 *  read loop. Once registered, the worker fires a `/b_getn` for the
 *  just-completed half of `bufnum` on every clock tick and posts the
 *  result back as a `scopeChunk` event keyed by `scopeId`.
 *
 *  `chunkSize` is a per-subscription concern (recordings in Phase 12
 *  will use a different value than scopes) — the worker stays
 *  oblivious to subscription kind and just reads `chunkSize × channels`
 *  samples each tick. */
export interface ScopeSubscription {
  scopeId: string;
  bufnum: number;
  chunkSize: number;
  channels: number;
}

/** One scope chunk delivered to the main thread. `data.length` =
 *  `chunkSize × channels`. The worker hands ownership over via
 *  `postMessage(..., [data.buffer])` — main consumers should not
 *  retain references that outlive a frame. */
export interface ScopeChunk {
  scopeId: string;
  data: Float32Array;
  channels: number;
  /** `tickIndex` of the tick whose `/b_getn` was answered by this
   *  chunk. Monotonic per-subscription. */
  tickIndex: number;
}

/** Per-recording subscription registered with the worker. Each tick
 *  the worker fires `/b_getn` for the just-completed half of `bufnum`,
 *  appends the resulting samples to an internal `WavMemoryWriter`
 *  keyed by `recordingId`, and notifies main via
 *  `recordingChunkWritten`. On `stopRecording` the worker finalises
 *  the WAV and posts `recordingDone` with the buffer transferred. */
export interface RecordingSubscription {
  recordingId: string;
  bufnum: number;
  channels: number;
  /** Sampled at start, stamped into the WAV header verbatim — must
   *  match scsynth's actual sample rate (`AppShell` validates this
   *  against `DEFAULT_ENV.sampleRate` at /status time). */
  sampleRate: number;
  /** How many audio samples-per-channel the recorder synth's
   *  `Phasor.ar` covers in one half (i.e. one tick's worth). The
   *  worker requests `samplesPerTick × channels` words on each
   *  `/b_getn`. */
  samplesPerTick: number;
  /** Retry policy for missing `/b_setn` replies. `maxAttempts = 1`
   *  disables retries and goes straight to gap-fill on first
   *  timeout. `deadlineMs` should be well under `tickIntervalMs` so a
   *  retry can land before the next tick races it. */
  retry: { maxAttempts: number; deadlineMs: number };
}

/** Live progress update sent after each successfully-appended chunk. */
export interface RecordingChunkWritten {
  recordingId: string;
  tickIndex: number;
  /** Cumulative frames (frames = samples-per-channel) written to the
   *  WAV so far, including any gap zero-fills. */
  framesWritten: number;
}

/** A run of zero-filled frames written in lieu of a missing
 *  `/b_setn`. The chunk is replaced with `framesMissing × channels`
 *  zeros so WAV time math stays linear; the gap is recorded in a
 *  sidecar JSON for downstream forensics. */
export interface RecordingGap {
  recordingId: string;
  tickIndex: number;
  framesMissing: number;
}

/** Final payload posted on `stopRecording`. Both `wav` and
 *  `gapsJson` are intended to land on the main thread as a unit
 *  ready for download. `wav` is sent as a `Transferable` — its
 *  ArrayBuffer is detached on the worker side after postMessage. */
export interface RecordingDone {
  recordingId: string;
  totalFrames: number;
  gaps: ReadonlyArray<{ tickIndex: number; framesMissing: number }>;
  wav: ArrayBuffer;
  /** Pre-stringified sidecar containing the gap list. Empty string if
   *  no gaps occurred — main side decides whether to offer it. */
  gapsJson: string;
}

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'send'; bytes: Uint8Array }
  | { type: 'registerClock'; trigId: number }
  | { type: 'unregisterClock' }
  | { type: 'subscribeScope'; subscription: ScopeSubscription }
  | { type: 'unsubscribeScope'; scopeId: string }
  | { type: 'startRecording'; subscription: RecordingSubscription }
  | { type: 'stopRecording'; recordingId: string };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'reply'; reply: OscReply }
  | { type: 'clockTick'; tick: ClockTick }
  | { type: 'scopeChunk'; chunk: ScopeChunk }
  | { type: 'recordingChunkWritten'; info: RecordingChunkWritten }
  | { type: 'recordingGap'; gap: RecordingGap }
  | { type: 'recordingDone'; done: RecordingDone }
  | { type: 'log'; level: 'log' | 'info' | 'warn' | 'error'; message: string };
