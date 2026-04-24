/**
 * Phase 2 — typed scope worker. Owns the WebSocket to the bridge AND
 * the jco-transpiled `scserver-commands` component. Main thread sends
 * typed `ServerMessage` values; worker encodes to OSC bytes, forwards,
 * decodes replies into typed `ServerReply` values, and posts them back.
 *
 * Decode failures (malformed OSC, or a reply shape outside the typed
 * catalogue — which the crate routes to `Other` rather than throwing)
 * surface as `error` events. The stream keeps flowing.
 */

import { commands, replies } from '@wasm/scserver-commands';
import type { MainToWorker, WorkerToMain } from '../scope/workerProtocol';
import { createOscTransport, type OscTransport } from './transport';

interface WorkerPost {
  postMessage(msg: WorkerToMain, transfer?: Transferable[]): void;
}
const post: WorkerPost['postMessage'] = (msg, transfer) => {
  (self as unknown as WorkerPost).postMessage(msg, transfer ?? []);
};

// Catch anything that would otherwise kill the worker silently — async
// init failures, unhandled rejections, etc. The main thread adds its
// own 'error' listener on the Worker instance, which fires *before*
// this handler runs (browsers dispatch error events on the global
// scope first), so we only reach here for runtime errors, not
// module-load failures.
self.addEventListener('error', (ev) => {
  post({
    type: 'error',
    message: `worker runtime error: ${ev.message || String(ev)}`,
  });
});
self.addEventListener('unhandledrejection', (ev) => {
  const reason = (ev as PromiseRejectionEvent).reason;
  post({
    type: 'error',
    message: `worker unhandled rejection: ${
      reason instanceof Error ? reason.message : String(reason)
    }`,
  });
});

let transport: OscTransport | null = null;

self.addEventListener('message', async (ev: MessageEvent<MainToWorker>) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'connect': {
      if (transport) {
        post({ type: 'error', message: 'already connected' });
        return;
      }
      try {
        transport = createOscTransport(msg.url);
        transport.onMessage((bytes) => {
          try {
            const reply = replies.decode(bytes);
            post({ type: 'reply', reply });
          } catch (err) {
            post({
              type: 'error',
              message: `decode failed: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        });
        transport.onError(() => {
          post({ type: 'error', message: 'websocket error' });
        });
        transport.onClose((closeEv) => {
          post({
            type: 'error',
            message: `websocket closed (code=${closeEv.code}${
              closeEv.reason ? `, reason=${closeEv.reason}` : ''
            })`,
          });
        });
        await transport.ready;
        post({ type: 'ready' });
      } catch (err) {
        transport = null;
        post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    case 'command': {
      if (!transport) {
        post({ type: 'error', message: 'command before connect' });
        return;
      }
      try {
        const bytes = commands.encode(msg.command);
        transport.send(bytes);
      } catch (err) {
        post({
          type: 'error',
          message: `encode failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      return;
    }

    case 'disconnect': {
      if (transport) {
        await transport.close();
        transport = null;
      }
      return;
    }
  }
});
