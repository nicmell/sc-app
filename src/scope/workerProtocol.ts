/**
 * Phase 1 — bytes-only protocol between the main thread and the scope
 * worker. Subsequent phases will swap the byte payloads for typed
 * `ServerMessage` / `ServerReply` values once `scserver-commands` is
 * wired in.
 */

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'send'; bytes: Uint8Array };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'recv'; bytes: Uint8Array };
