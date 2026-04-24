/**
 * Main ↔ worker protocol. Phase 2 swaps the bytes-only messages for
 * typed `ServerMessage` (outgoing) and `ServerReply` (incoming). The
 * worker owns the wasm component that does encode/decode; the main
 * thread never touches raw OSC bytes.
 */

import type { ServerMessage } from '@wasm/scserver-commands/interfaces/scserver-commands-commands';
import type { ServerReply } from '@wasm/scserver-commands/interfaces/scserver-commands-replies';

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'command'; command: ServerMessage };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'reply'; reply: ServerReply };

export type { ServerMessage, ServerReply };
