/**
 * OSC worker — owns the WebSocket to the bridge. Main thread does
 * the OSC encoding (osc-js via `@sc-app/server-commands`); we just
 * forward bytes either direction. Inbound bytes are decoded here so
 * the main thread receives plain `{ address, args }` POJOs.
 *
 * Phase 31c rewrite. Pre-31 the worker owned a tick-driven `/b_getn`
 * loop with offset-keyed pending tracking, a tick-ordered reorder
 * buffer, retry policy, and gap synthesis — all to compensate for
 * the OSC-over-UDP transport's quirks. Post-31 the bridge owns
 * SHM-based scope-buffer ingestion entirely; the worker just:
 *
 *   - Forwards OSC bytes both directions (unchanged).
 *   - Translates `subscribeBuffer` / `unsubscribeBuffer` from main
 *     into `0x01` / `0x02` op-tagged binary frames sent to the
 *     bridge over the same WS.
 *   - Decodes inbound `0x03` chunk frames from the bridge into
 *     `bufferChunk` events for the main thread (same shape as
 *     pre-31; consumers don't see the transport change).
 *
 * `pendingByOffset`, `reorderBuffer`, retry logic, gap synthesis,
 * `fireReads`, `/b_setn` dispatch, `skipFirstTick` — all retired.
 * Bridge handles whatever gap/timing logic ends up being necessary.
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
  MainToWorker,
  OscReply,
  WorkerToMain,
} from '../server/workerProtocol';
import { createOscTransport, type OscTransport } from './transport';
import {
  decodeChunk,
  encodeSubscribe,
  encodeUnsubscribe,
  SCOPE_OP_CHUNK,
} from './scopeWire';

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

/** Address-match constant for the shared clock's tick replies.
 *  Phase 30 post-shipping cleanup — the clock SynthDef emits via
 *  `SendReply.kr(tick, '/clock/tick', count)` instead of the
 *  pre-cleanup `SendTrig.kr(tick, 1000, count)`. Worker matches
 *  the address; no registration step from main needed. */
const CLOCK_TICK_ADDRESS = '/clock/tick';

/** Top-level dispatch for an inbound binary WS frame. Phase 31c:
 *  the bridge multiplexes OSC replies and `0x03` scope chunks on
 *  the same socket; we peek the first byte and route. */
function handleInboundBytes(bytes: Uint8Array): void {
  if (bytes.length === 0) return;
  if (bytes[0] === SCOPE_OP_CHUNK) {
    try {
      const chunk = decodeChunk(bytes);
      post(
        {
          type: 'bufferChunk',
          chunk: {
            bufferId: chunk.bufferId,
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
      post({
        type: 'error',
        message: `scope chunk decode failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
    }
    return;
  }
  // Anything else: assume OSC bytes.
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

function emitReply(packet: OscPacket): void {
  if (isMessage(packet)) {
    // Clock tick intercept: emit a typed clockTick event for the
    // ClockController's freshness watchdog. SendReply args are
    // `nodeID replyID value0 …`, so `args[2]` is the PulseCount
    // value (the tick index).
    if (packet.address === CLOCK_TICK_ADDRESS) {
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
      if (transport) {
        await transport.close();
        transport = null;
      }
      return;
    }

    case 'subscribeBuffer': {
      if (!transport) {
        post({ type: 'error', message: 'subscribeBuffer before connect' });
        return;
      }
      const sub = msg.subscription;
      console.log(
        `[sc:worker] subscribeBuffer id=${sub.bufferId} scopeNum=${sub.scopeNum} ` +
          `chunkSize=${sub.chunkSize} channels=${sub.channels}`,
      );
      transport.send(
        encodeSubscribe(sub.bufferId, sub.scopeNum, sub.channels, sub.chunkSize),
      );
      return;
    }

    case 'unsubscribeBuffer': {
      if (!transport) return;
      console.log(`[sc:worker] unsubscribeBuffer id=${msg.bufferId}`);
      transport.send(encodeUnsubscribe(msg.bufferId));
      return;
    }
  }
});
