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

/** SHM scope-buffer subscription registered with the worker. One
 *  entry per `bufferId`; multiple main-thread listeners on the
 *  same `bufferId` share the worker subscription (the
 *  `WorkerClient` fans out chunks on the main side).
 *
 *  Phase 31 rewrite: pre-31 this was a `/b_getn`-driven OSC ring
 *  read; post-31 the bridge mmaps scsynth's SHM scope_buffer pool
 *  and pushes pre-decoded chunks down the WS as `0x03`-tagged
 *  binary frames. The shape here covers what the worker forwards
 *  to the bridge in the matching `0x01` subscribe frame. */
export interface BufferSubscription {
  /** Stable identifier chosen by the caller. The worker keys its
   *  subscription table on this; main-side fan-out routes
   *  `bufferChunk` events back to listeners by this id. */
  bufferId: string;
  /** Scope buffer index (0..127) sclang's
   *  `s.scopeBufferAllocator` returned for this consumer. The
   *  bridge maps this to a byte offset in the SHM segment via
   *  `find_scope_buffer_array` and reads slots from there. */
  scopeNum: number;
  channels: number;
  /** Frames per chunk (= `ScopeOut2`'s `scopeFrames` parameter
   *  baked into the tap SynthDef). One chunk = one slot of the
   *  scope_buffer triple-buffer = one tick of audio. */
  chunkSize: number;
}

/** One chunk delivered to main. Posted on every bridge-emitted
 *  `0x03` frame for an active subscription. Consumers see chunks
 *  in arrival order; gap detection is bridge-side and surfaces via
 *  `isGap: true` chunks.
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
  /** Tick-counter associated with the chunk. Bridge-supplied
   *  (currently 0, until the bridge wires its `/clock/tick`
   *  observer through to chunk emission — Phase 31c follow-up). */
  tickIndex: number;
  /** True when the chunk is a bridge-synthesized zero-fill in lieu
   *  of a missed scope_buffer slot (writer outpaced reader).
   *  Recordings materialize this as a gap entry; scopes typically
   *  ignore the flag and render the zeros as silence. */
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
