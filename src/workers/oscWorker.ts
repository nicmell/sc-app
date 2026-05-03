/**
 * OSC worker — owns the WebSocket to the bridge. Main thread does
 * the OSC encoding (osc-js via `@sc-app/server-commands`); we just
 * forward bytes either direction. Inbound bytes are decoded here so
 * the main thread receives plain `{ address, args }` POJOs.
 *
 * Phase 35: scope chunk delivery is back in-band on the main /ws
 * (after a brief detour through per-scope `/ws/scope` connections in
 * Phase 31's post-shipping refactor). One Web Worker, one transport,
 * one WS — scope subscribe/unsubscribe/chunk frames travel as binary
 * messages with op-tag discriminators (0x01/0x02/0x03 — see
 * `scopeWire.ts`). Inbound `transport.onMessage` peeks the first byte
 * to dispatch between OSC decode and chunk decode. Subscription IDs
 * are integer counters minted here; the bridge echoes them back on
 * chunk frames and we look up the consumer-facing `bufferId` to fan
 * out to listeners.
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
import {
  decodeChunk,
  encodeSubscribe,
  encodeUnsubscribe,
  isScopeFrame,
} from './scopeWire';
import {
  handleSequencerBankUpdate,
  handleSequencerClockUpdate,
  handleSequencerDisconnect,
  handleSequencerPauseUpdate,
  handleSequencerStart,
  handleSequencerStop,
  setSequencerSender,
} from './sequencerPump';
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

// Phase 35: scope subscription bookkeeping. Wire format uses an
// integer `sub_id` minted here; the bridge echoes it back on chunk
// frames. We dispatch chunks to main-thread listeners by the
// consumer-facing `bufferId`, so we maintain both directions.
let nextSubId = 1;
const subIdByBufferId = new Map<string, number>();
const bufferIdBySubId = new Map<number, string>();

const CLOCK_TICK_ADDRESS = '/clock/tick';

function clearScopeSubscriptions(): void {
  subIdByBufferId.clear();
  bufferIdBySubId.clear();
  nextSubId = 1;
}

function handleSubscribeBuffer(sub: BufferSubscription): void {
  if (!transport) {
    post({ type: 'error', message: 'subscribeBuffer before connect' });
    return;
  }
  // Re-subscribing with the same bufferId: tear down the old
  // subscription on the bridge first so its state matches ours.
  // (Duplicate subscribe usually means the consumer restarted.)
  const stale = subIdByBufferId.get(sub.bufferId);
  if (stale !== undefined) {
    transport.send(encodeUnsubscribe(stale));
    bufferIdBySubId.delete(stale);
  }
  const subId = nextSubId++;
  subIdByBufferId.set(sub.bufferId, subId);
  bufferIdBySubId.set(subId, sub.bufferId);
  transport.send(
    encodeSubscribe(subId, {
      scope: sub.scopeNum,
      channels: sub.channels,
      chunkSize: sub.chunkSize,
    }),
  );
}

function handleUnsubscribeBuffer(bufferId: string): void {
  const subId = subIdByBufferId.get(bufferId);
  if (subId === undefined) return;
  subIdByBufferId.delete(bufferId);
  bufferIdBySubId.delete(subId);
  if (transport) {
    transport.send(encodeUnsubscribe(subId));
  }
  // No transport ⇒ already disconnected; the bridge's per-WS
  // cleanup has already dropped the subscription server-side.
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

/** Dispatch one inbound binary frame from the main /ws. Phase 35:
 *  peek the first byte. 0x03 → scope chunk (decode + dispatch by
 *  bufferId); otherwise → OSC decode path. The op-tag space
 *  (0x01..0x03) cannot collide with OSC since OSC frames always
 *  start with `/` (0x2F) or `#` (0x23). */
function handleInboundBytes(bytes: Uint8Array): void {
  if (isScopeFrame(bytes)) {
    try {
      const chunk = decodeChunk(bytes);
      const bufferId = bufferIdBySubId.get(chunk.subId);
      if (bufferId === undefined) {
        // Could be a chunk for a subscription we just unsubscribed
        // from — bridge had a chunk in flight when our 0x02 frame
        // arrived. Drop silently; not an error.
        return;
      }
      post(
        {
          type: 'bufferChunk',
          chunk: {
            bufferId,
            data: chunk.data,
            channels: chunk.channels,
            tickIndex: chunk.tickIndex,
            isGap: chunk.isGap,
          },
        },
        [chunk.data.buffer],
      );
    } catch (err) {
      console.error('[sc:worker] scope chunk decode failed', err);
    }
    return;
  }
  // OSC path.
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
        transport = createOscTransport(msg.url);
        transport.onMessage(handleInboundBytes);
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
      handleSequencerDisconnect();
      setSequencerSender(null);
      disconnectClockWatchdog();
      clearScopeSubscriptions();
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
      handleSubscribeBuffer(sub);
      return;
    }

    case 'unsubscribeBuffer': {
      console.log(`[sc:worker] unsubscribeBuffer id=${msg.bufferId}`);
      handleUnsubscribeBuffer(msg.bufferId);
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
