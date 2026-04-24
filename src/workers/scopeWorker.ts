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

// Install the console → main-thread bridge FIRST — ESM runs imports
// in source order, so anything earlier in this file than the wasm
// import is guaranteed to execute before `await $init` fires.
import './workerConsoleBridge';

console.log('[sc:worker] module loading …');

import { commands, replies } from '@wasm/scserver-commands';
console.log('[sc:worker] wasm bindings imported OK', {
  hasEncode: typeof commands?.encode,
  hasDecode: typeof replies?.decode,
});

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
  console.error('[sc:worker] runtime error', ev);
  post({
    type: 'error',
    message: `worker runtime error: ${ev.message || String(ev)}`,
  });
});
self.addEventListener('unhandledrejection', (ev) => {
  const reason = (ev as PromiseRejectionEvent).reason;
  console.error('[sc:worker] unhandled rejection', reason);
  post({
    type: 'error',
    message: `worker unhandled rejection: ${
      reason instanceof Error ? reason.message : String(reason)
    }`,
  });
});

console.log('[sc:worker] ready for messages');

let transport: OscTransport | null = null;

self.addEventListener('message', async (ev: MessageEvent<MainToWorker>) => {
  const msg = ev.data;
  console.log('[sc:worker] main → worker', msg.type);
  switch (msg.type) {
    case 'connect': {
      if (transport) {
        console.warn('[sc:worker] already connected, ignoring');
        post({ type: 'error', message: 'already connected' });
        return;
      }
      try {
        console.log('[sc:worker] creating transport', msg.url);
        transport = createOscTransport(msg.url);
        transport.onMessage((bytes) => {
          try {
            const reply = replies.decode(bytes);
            post({ type: 'reply', reply });
          } catch (err) {
            console.error('[sc:worker] decode failed', err, bytes);
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
        console.log('[sc:worker] awaiting ws open …');
        await transport.ready;
        console.log('[sc:worker] posting ready');
        post({ type: 'ready' });
      } catch (err) {
        console.error('[sc:worker] connect failed', err);
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
        console.error('[sc:worker] encode failed', err, msg.command);
        post({
          type: 'error',
          message: `encode failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      return;
    }

    case 'disconnect': {
      console.log('[sc:worker] disconnect');
      if (transport) {
        await transport.close();
        transport = null;
      }
      return;
    }
  }
});
