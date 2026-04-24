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

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'send'; bytes: Uint8Array }
  | { type: 'registerClock'; trigId: number }
  | { type: 'unregisterClock' };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'reply'; reply: OscReply }
  | { type: 'clockTick'; tick: ClockTick }
  | { type: 'log'; level: 'log' | 'info' | 'warn' | 'error'; message: string };
