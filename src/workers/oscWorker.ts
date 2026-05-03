/**
 * OSC worker — owns the WebSocket to the bridge. Main thread does
 * the OSC encoding (osc-js via `@sc-app/server-commands`); we just
 * forward bytes either direction. Inbound bytes are decoded here so
 * the main thread receives plain `{ address, args }` POJOs.
 *
 * Phase 31 post-shipping refactor: scope buffer chunk delivery now
 * uses a SEPARATE WebSocket per subscription (`/ws/scope?...`); the
 * main WS is back to pure OSC. The worker still owns lifecycle —
 * `subscribeBuffer` opens a scope WS, `unsubscribeBuffer` closes
 * it, scope-WS messages decode into `bufferChunk` events posted to
 * main with the data ArrayBuffer transferred. Consumer-facing API
 * (`subscribeBuffer` / `bufferChunk`) is unchanged.
 *
 * Decode failures surface as `error` events; the stream keeps flowing.
 */

// Bootstrap FIRST — installs a synchronous message listener that
// buffers incoming messages until the real handler is wired up.
import { setWorkerMessageHandler } from './workerBootstrap';

// Then the console bridge.
import './workerConsoleBridge';

console.log('[sc:worker] module loading …');

import {
  decode,
  isBundle,
  isMessage,
  type OscPacket,
} from '@sc-app/server-commands';
import type {
  BufferSubscription,
  MainToWorker,
  OscReply,
  WorkerToMain,
} from '../server/workerProtocol';
import { createOscTransport, type OscTransport } from './transport';
import { decodeScopeFrame } from './scopeWire';
import {
  handleSequencerBankUpdate,
  handleSequencerClockUpdate,
  handleSequencerDisconnect,
  handleSequencerPauseUpdate,
  handleSequencerStart,
  handleSequencerStop,
  setSequencerSender,
} from './sequencerWorker';
import {
  disconnectClockWatchdog,
  recordClockTick,
  startClockWatchdog,
  stopClockWatchdog,
} from './clockWatchdog';

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
/** Main WS URL captured at connect time. Used to derive scope-WS
 *  URLs with the same origin + session UUID. Cleared on disconnect. */
let mainWsUrl: string | null = null;

/** Active per-scope WSs keyed by `bufferId`. Closed on
 *  `unsubscribeBuffer` or `disconnect`. */
const scopeWebSockets = new Map<string, WebSocket>();

const CLOCK_TICK_ADDRESS = '/clock/tick';

/** Build a `/ws/scope` URL from the session-attached main WS URL +
 *  the subscription params. Same origin, same session, just a
 *  different path with the scope-specific query parameters. */
function buildScopeWsUrl(mainUrl: string, sub: BufferSubscription): string {
  const url = new URL(mainUrl);
  url.pathname = '/ws/scope';
  const session = url.searchParams.get('session') ?? '';
  url.search = '';
  url.searchParams.set('session', session);
  url.searchParams.set('scope', String(sub.scopeNum));
  url.searchParams.set('channels', String(sub.channels));
  url.searchParams.set('chunkSize', String(sub.chunkSize));
  url.searchParams.set('bufferId', sub.bufferId);
  return url.toString();
}

function openScopeWs(sub: BufferSubscription): void {
  if (!mainWsUrl) {
    post({ type: 'error', message: 'subscribeBuffer before connect' });
    return;
  }
  // Replace any existing WS for the same bufferId — duplicate
  // subscribe usually means the consumer restarted.
  const stale = scopeWebSockets.get(sub.bufferId);
  if (stale) {
    try {
      stale.close();
    } catch {
      /* best effort */
    }
  }
  const url = buildScopeWsUrl(mainWsUrl, sub);
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';
  ws.onmessage = (ev) => {
    if (!(ev.data instanceof ArrayBuffer)) return;
    try {
      const frame = decodeScopeFrame(new Uint8Array(ev.data));
      post(
        {
          type: 'bufferChunk',
          chunk: {
            bufferId: sub.bufferId,
            data: frame.data,
            channels: frame.channels,
            tickIndex: frame.tickIndex,
            isGap: frame.isGap,
          },
        },
        [frame.data.buffer],
      );
    } catch (err) {
      console.error('[sc:worker] scope frame decode failed', err);
    }
  };
  ws.onerror = (ev) => {
    console.warn(`[sc:worker] scope ws ${sub.bufferId} error`, ev);
  };
  ws.onclose = () => {
    if (scopeWebSockets.get(sub.bufferId) === ws) {
      scopeWebSockets.delete(sub.bufferId);
    }
  };
  scopeWebSockets.set(sub.bufferId, ws);
}

function closeScopeWs(bufferId: string): void {
  const ws = scopeWebSockets.get(bufferId);
  if (!ws) return;
  scopeWebSockets.delete(bufferId);
  try {
    ws.close();
  } catch {
    /* best effort */
  }
}

function closeAllScopeWs(): void {
  for (const ws of scopeWebSockets.values()) {
    try {
      ws.close();
    } catch {
      /* best effort */
    }
  }
  scopeWebSockets.clear();
}

function emitReply(packet: OscPacket): void {
  if (isMessage(packet)) {
    // Clock tick intercept: emit a typed clockTick event +
    // record the tick for the worker-side freshness watchdog
    // (Phase 33b). SendReply args are `nodeID replyID value0 …`,
    // so `args[2]` is the PulseCount value (the tick index).
    if (packet.address === CLOCK_TICK_ADDRESS) {
      recordClockTick();
      const tickIndex = (packet.args[2] as number) | 0;
      post({
        type: 'clockTick',
        tick: { tickIndex, receivedAt: performance.now() },
      });
      return;
    }

    // Phase 24: /fail intercept. Emit a typed oscError alongside the
    // normal reply emission — existing /fail awaiters (e.g.
    // SynthDefRegistry's /fail /d_recv matcher) keep firing via
    // onReply; ServerErrorBus picks up everything else from this
    // channel without competing with awaiters.
    if (packet.address === '/fail') {
      const args = packet.args as OscReply['args'];
      post({
        type: 'oscError',
        error: {
          commandAddress: (args[0] as string | undefined) ?? '',
          errorString: (args[1] as string | undefined) ?? '',
          extras: args.slice(2),
          receivedAt: performance.now(),
        },
      });
      // Fall through — reply still posts below.
    }

    const reply: OscReply = {
      address: packet.address,
      args: packet.args as OscReply['args'],
    };
    post({ type: 'reply', reply });
  } else if (isBundle(packet)) {
    // Flatten bundles: emit each inner element individually. scsynth
    // rarely replies with bundles, but some `/done` confirmations
    // and NRT-style responses can arrive this way.
    for (const el of packet.bundleElements) {
      emitReply(el as OscPacket);
    }
  }
}

setWorkerMessageHandler(async (msg: MainToWorker) => {
  switch (msg.type) {
    case 'connect': {
      if (transport) {
        console.warn('[sc:worker] already connected, ignoring');
        post({ type: 'error', message: 'already connected' });
        return;
      }
      try {
        console.log('[sc:worker] creating transport', msg.url);
        mainWsUrl = msg.url;
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
        // Phase 32: hand the sequencer worker a direct sender into
        // this transport so its pump can ship OSC bytes without a
        // postMessage hop.
        setSequencerSender((bytes) => transport!.send(bytes));
        console.log('[sc:worker] posting ready');
        post({ type: 'ready' });
      } catch (err) {
        console.error('[sc:worker] connect failed', err);
        transport = null;
        mainWsUrl = null;
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
      closeAllScopeWs();
      handleSequencerDisconnect();
      setSequencerSender(null);
      disconnectClockWatchdog();
      mainWsUrl = null;
      if (transport) {
        await transport.close();
        transport = null;
      }
      return;
    }

    case 'subscribeBuffer': {
      const sub = msg.subscription;
      console.log(
        `[sc:worker] subscribeBuffer id=${sub.bufferId} scopeNum=${sub.scopeNum} ` +
          `chunkSize=${sub.chunkSize} channels=${sub.channels}`,
      );
      openScopeWs(sub);
      return;
    }

    case 'unsubscribeBuffer': {
      console.log(`[sc:worker] unsubscribeBuffer id=${msg.bufferId}`);
      closeScopeWs(msg.bufferId);
      return;
    }

    case 'sequencerStart': {
      handleSequencerStart({
        bank: msg.bank,
        clock: msg.clock,
        isGroupPaused: msg.isGroupPaused,
      });
      return;
    }

    case 'sequencerStop': {
      handleSequencerStop();
      return;
    }

    case 'sequencerBankUpdate': {
      handleSequencerBankUpdate(msg.bank);
      return;
    }

    case 'sequencerClockUpdate': {
      handleSequencerClockUpdate(msg.clock);
      return;
    }

    case 'sequencerPauseUpdate': {
      handleSequencerPauseUpdate(msg.isGroupPaused);
      return;
    }

    case 'clockWatchdogStart': {
      startClockWatchdog(msg.tickIntervalMs);
      return;
    }

    case 'clockWatchdogStop': {
      stopClockWatchdog();
      return;
    }
  }
});
