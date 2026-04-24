/**
 * Phase 1 — scope worker entry. Owns the WebSocket to the WS↔UDP
 * bridge. Main thread talks to this worker via typed `postMessage`;
 * the worker forwards bytes both ways.
 *
 * Later phases will expand this file to parse typed `ServerReply`
 * values, drive the subscription table, etc. Phase 1 is byte-only.
 */

import type { MainToWorker, WorkerToMain } from '../scope/workerProtocol';
import { createOscTransport, type OscTransport } from './transport';

// The worker-side postMessage. `self` in a Worker context has a
// two-arg postMessage but the DOM lib typing only sees the window
// overload; cast through `unknown` to keep the protocol tight at the
// boundary without pulling the whole WebWorker lib into tsconfig.
interface WorkerPost {
  postMessage(msg: WorkerToMain, transfer?: Transferable[]): void;
}
const post: WorkerPost['postMessage'] = (msg, transfer) => {
  (self as unknown as WorkerPost).postMessage(msg, transfer ?? []);
};

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
          // Transfer the underlying ArrayBuffer to avoid copying.
          const buf = bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          );
          post({ type: 'recv', bytes: new Uint8Array(buf) }, [buf]);
        });
        transport.onError(() => {
          post({ type: 'error', message: 'websocket error' });
        });
        transport.onClose((ev) => {
          post({
            type: 'error',
            message: `websocket closed (code=${ev.code}${ev.reason ? `, reason=${ev.reason}` : ''})`,
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

    case 'send': {
      if (!transport) {
        post({ type: 'error', message: 'send before connect' });
        return;
      }
      try {
        transport.send(msg.bytes);
      } catch (err) {
        post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
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
