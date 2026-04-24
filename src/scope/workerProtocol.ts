/**
 * Main ↔ worker protocol. Phase 2 swaps the bytes-only messages for
 * typed `ServerMessage` (outgoing) and `ServerReply` (incoming). The
 * worker owns the wasm component that does encode/decode; the main
 * thread never touches raw OSC bytes.
 */

import type { ServerMessage } from '@wasm/scserver-commands/interfaces/scserver-commands-commands';
import type { ServerReply } from '@wasm/scserver-commands/interfaces/scserver-commands-replies';

/** One decoded clock tick. Emitted by the worker when a `/tr` reply
 *  arrives whose `triggerId` matches the currently-registered clock
 *  trigId. The generic `reply` event is suppressed for those messages. */
export interface ClockTick {
  /** `reply.val.value | 0` — monotonic pulse count from the synth. */
  tickIndex: number;
  /** `performance.now()` on the worker side when the reply decoded. */
  receivedAt: number;
}

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'command'; command: ServerMessage }
  | { type: 'registerClock'; trigId: number }
  | { type: 'unregisterClock' };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'reply'; reply: ServerReply }
  | { type: 'clockTick'; tick: ClockTick }
  | { type: 'log'; level: 'log' | 'info' | 'warn' | 'error'; message: string };

export type { ServerMessage, ServerReply };
