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
 *
 * Phase 17 unified the subscription protocol: one
 * `BufferSubscription` covers what used to be split into
 * `ScopeSubscription` + `RecordingSubscription`. The worker keeps
 * one entry per `bufferId`, fans /b_setn replies back as
 * `bufferChunk` events, and applies the offset-keyed pending +
 * tick-ordered reorder buffer + retry policy uniformly. WAV writing
 * and gap-sidecar accounting moved to main thread (in
 * `RecordingController`); the worker is now subscription-agnostic.
 */

import type { OscArg } from '@sc-app/server-commands';

/** Plain representation of an inbound OSC message as seen on the
 *  main thread after postMessage. Matches `OSC.Message`'s field
 *  shape (minus methods). */
export interface OscReply {
  address: string;
  args: ReadonlyArray<OscArg>;
}

/** Phase 24 — decoded `/fail` reply. scsynth replies with
 *  `/fail /<originatingCommand> "<error>" [extras]` on every
 *  rejection (missing SynthDef, /b_setn against a freed buffer,
 *  /n_free on a stale node, …). The worker emits these as a
 *  separate `oscError` event in addition to the generic `reply`
 *  channel — existing /fail awaiters (e.g. SynthDefRegistry's
 *  /fail /d_recv handler) keep working via onReply; the bus
 *  catches everything else. */
export interface OscError {
  /** The address of the command scsynth rejected, e.g. `/s_new`,
   *  `/b_alloc`. Comes from `args[0]` of the `/fail` reply. */
  commandAddress: string;
  /** Human-readable error string from `args[1]`. May be empty if
   *  scsynth omitted it (rare). */
  errorString: string;
  /** Anything past `args[1]` — typically empty, occasionally
   *  carries an offending nodeId or bufnum. */
  extras: ReadonlyArray<OscArg>;
  /** `performance.now()` in the worker thread at decode time. */
  receivedAt: number;
}

/** One decoded clock tick. Emitted by the worker when a
 *  `/clock/tick` reply arrives (sclang's `\scAppClock` SynthDef
 *  emits these via `SendReply.kr`). The generic `reply` event is
 *  suppressed for those messages so they don't show up in the OSC
 *  console at the tick rate. */
export interface ClockTick {
  /** Monotonic pulse count from the synth. */
  tickIndex: number;
  /** Worker-side `performance.now()` at decode time. Cross-thread clocks
   *  differ, so consumers that need freshness checks should stamp
   *  on the main thread. */
  receivedAt: number;
}

/** Tick-driven `/b_getn` subscription registered with the worker.
 *  One entry per `bufferId`; multiple main-thread listeners on the
 *  same `bufferId` share the worker subscription (the
 *  `WorkerClient` fans out replies on the main side). */
export interface BufferSubscription {
  /** Stable identifier chosen by the caller. The worker keys its
   *  subscription table on this; main-side fan-out routes
   *  `bufferChunk` events back to listeners by this id. */
  bufferId: string;
  /** scsynth bufnum the tap synth is writing into. The worker
   *  matches inbound /b_setn replies by bufnum → bufferId. */
  bufnum: number;
  channels: number;
  /** Frames-per-channel per chunk (= `samplesPerTick` per
   *  `clock.derived`). The worker fires one /b_getn per tick reading
   *  `chunkSize × channels` samples from the just-completed half. */
  chunkSize: number;
  /** Skip the first tick after subscribing. Default `true` — the
   *  buffer holds a partial half between /b_alloc (zero-fill) and
   *  the first tick boundary; reading it would emit one bogus chunk
   *  before steady state. */
  skipFirstTick?: boolean;
  /** Retry policy for missing /b_setn replies. Default
   *  `{ maxAttempts: 1, deadlineMs: 50 }`. On exhaustion the worker
   *  emits a synthetic zero-fill chunk (`isGap: true`) so consumers
   *  see one chunk per tick regardless of network jitter. */
  retry?: { maxAttempts: number; deadlineMs: number };
}

/** One chunk delivered to main. Posted on every successful /b_setn
 *  *and* on retry exhaustion (zero-filled, `isGap: true`). Consumers
 *  see chunks in strict tick order — the worker's reorder buffer
 *  holds out-of-order replies until their slot drains.
 *
 *  `data.length === chunkSize × channels`. The Float32Array is
 *  transferred (its underlying ArrayBuffer is detached on the worker
 *  side after postMessage); main-side fan-out passes the same
 *  reference to every listener — treat it as read-only and don't
 *  retain past one tick. */
export interface BufferChunk {
  bufferId: string;
  data: Float32Array;
  channels: number;
  /** `tickIndex` of the tick whose /b_getn was answered (or
   *  zero-filled). Monotonically increasing per `bufferId`. */
  tickIndex: number;
  /** True when the chunk is a worker-synthesized zero-fill in lieu
   *  of a missing /b_setn reply. Recordings materialize this as a
   *  gap entry; scopes typically ignore the flag and render the
   *  zeros as silence. */
  isGap: boolean;
}

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'send'; bytes: Uint8Array }
  | { type: 'subscribeBuffer'; subscription: BufferSubscription }
  | { type: 'unsubscribeBuffer'; bufferId: string };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'reply'; reply: OscReply }
  | { type: 'oscError'; error: OscError }
  | { type: 'clockTick'; tick: ClockTick }
  | { type: 'bufferChunk'; chunk: BufferChunk }
  | { type: 'log'; level: 'log' | 'info' | 'warn' | 'error'; message: string };
