/**
 * Scope worker — owns the WebSocket to the bridge. Main thread does
 * the OSC encoding (osc-js via `@sc-app/server-commands`); we just
 * forward bytes either direction. Inbound bytes are decoded here so
 * the main thread receives plain `{ address, args }` POJOs.
 *
 * Decode failures surface as `error` events; the stream keeps flowing.
 */

// Bootstrap FIRST — installs a synchronous message listener that
// buffers incoming messages until the real handler is wired up.
import { setWorkerMessageHandler } from './workerBootstrap';

// Then the console bridge.
import './workerConsoleBridge';

console.log('[sc:worker] module loading …');

import { decode, isBundle, isMessage, type OscPacket } from '@sc-app/server-commands';
import type { MainToWorker, OscReply, WorkerToMain } from '../scope/workerProtocol';
import { createOscTransport, type OscTransport } from './transport';

interface WorkerPost {
  postMessage(msg: WorkerToMain, transfer?: Transferable[]): void;
}
const post: WorkerPost['postMessage'] = (msg, transfer) => {
  (self as unknown as WorkerPost).postMessage(msg, transfer ?? []);
};

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
let clockTrigId: number | null = null;

function emitReply(packet: OscPacket): void {
  if (isMessage(packet)) {
    // Clock /tr intercept: suppress the generic reply and emit a
    // typed clockTick instead when the triggerId matches the
    // currently-registered clock.
    if (
      clockTrigId !== null &&
      packet.address === '/tr' &&
      packet.args[1] === clockTrigId
    ) {
      post({
        type: 'clockTick',
        tick: {
          tickIndex: (packet.args[2] as number) | 0,
          receivedAt: performance.now(),
        },
      });
      return;
    }
    const reply: OscReply = {
      address: packet.address,
      args: packet.args as OscReply['args'],
    };
    post({ type: 'reply', reply });
  } else if (isBundle(packet)) {
    // Flatten bundles: emit each inner element individually. scsynth
    // rarely replies with bundles, but some `/done` confirmations and
    // NRT-style responses can arrive this way.
    for (const el of packet.bundleElements) {
      emitReply(el as OscPacket);
    }
  }
}

setWorkerMessageHandler(async (msg: MainToWorker) => {
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
            const packet = decode(bytes);
            emitReply(packet);
          } catch (err) {
            console.error('[sc:worker] decode failed', err, bytes);
            post({
              type: 'error',
              message: `decode failed: ${
                err instanceof Error ? err.message : String(err)
              }`,
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
        post({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    case 'send': {
      if (!transport) {
        post({ type: 'error', message: 'send before connect' });
        return;
      }
      transport.send(msg.bytes);
      return;
    }

    case 'disconnect': {
      console.log('[sc:worker] disconnect');
      clockTrigId = null;
      if (transport) {
        await transport.close();
        transport = null;
      }
      return;
    }

    case 'registerClock': {
      console.log('[sc:worker] registerClock', msg.trigId);
      clockTrigId = msg.trigId;
      return;
    }

    case 'unregisterClock': {
      console.log('[sc:worker] unregisterClock');
      clockTrigId = null;
      return;
    }
  }
});
