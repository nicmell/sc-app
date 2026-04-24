/**
 * Scope worker — owns the WebSocket to the bridge. Main thread does
 * the OSC encoding (osc-js via `@sc-app/server-commands`); we just
 * forward bytes either direction. Inbound bytes are decoded here so
 * the main thread receives plain `{ address, args }` POJOs.
 *
 * Phase 8 adds a tick-driven read loop for subscribed scope buffers:
 * on each clock tick the worker fires `/b_getn` for the just-completed
 * half of every subscribed bufnum, and routes the matching `/b_setn`
 * replies back to main as zero-copy `scopeChunk` events.
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
  OSC,
  bGetn,
  decode,
  encode,
  isBundle,
  isMessage,
  type OscPacket,
} from '@sc-app/server-commands';
import { READ_DELAY_MS } from '../config/clockConfig';
import type {
  MainToWorker,
  OscReply,
  ScopeSubscription,
  WorkerToMain,
} from '../scope/workerProtocol';
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

/** Per-bufnum subscription state. The worker keeps one entry per
 *  bufnum; `/b_setn` replies are matched by bufnum (scsynth doesn't
 *  carry a request id), so every subscription needs its own buffer. */
interface SubscriptionEntry {
  sub: ScopeSubscription;
  /** Tick the most recent `/b_getn` was sent under, or null if no
   *  read in flight. Used solely as a tag so the dispatched
   *  `scopeChunk` can carry the right `tickIndex`. */
  pendingTickIndex: number | null;
}

const subscriptions = new Map<number /* bufnum */, SubscriptionEntry>();
const subsByScopeId = new Map<string, number /* bufnum */>();

/** Send `/b_getn` for every subscribed bufnum, asking for the half
 *  that just completed at the given tick. Must be called from the
 *  `/tr` decode path so `tickIndex` is fresh.
 *
 *  Each `/b_getn` is wrapped in an `OSC.Bundle` with timetag
 *  `Date.now() + READ_DELAY_MS` so scsynth's scheduler holds the
 *  read until past the kr-vs-ar drift between the `Impulse.kr`-driven
 *  `/tr` and the `Phasor.ar`-driven `writeIdx`. Without this delay,
 *  some ticks land 1–32 ar samples short of the half-boundary and
 *  the read includes stale samples from the previous cycle, showing
 *  up as a vertical step inside an otherwise-smooth chunk. */
function fireReads(tickIndex: number): void {
  if (!transport || subscriptions.size === 0) return;
  // `Impulse.kr(tickRate, 0)` fires at t=0 (tick 1, audio frame 0),
  // then every `samplesPerTick` ar frames. So tick N fires at frame
  // `(N-1) × samplesPerTick`, and the scope's `writeIdx` at that
  // moment is `((N-1) × samplesPerTick / decimation) mod (chunkSize ×
  // 2)` = `((N-1) % 2) × chunkSize`.
  //
  //   N=2 (even): writeIdx = chunkSize  → just finished [0, chunkSize)
  //                                        — the FIRST half. Read offset 0.
  //   N=3 (odd):  writeIdx = 0          → just finished [chunkSize, chunkSize×2)
  //                                        — the SECOND half. Read offset chunkSize.
  //
  // So `completedHalf = tickIndex % 2`. Tick 1 reads offset chunkSize
  // and lands on whatever was in the buffer at /b_alloc time
  // (silence). That's expected — the first useful chunk arrives at
  // tick 2.
  const completedHalf = tickIndex % 2; // 0 when N even, 1 when N odd
  const fireAt = Date.now() + READ_DELAY_MS;
  for (const entry of subscriptions.values()) {
    const { bufnum, chunkSize, channels } = entry.sub;
    const offset = completedHalf * chunkSize * channels;
    const count = chunkSize * channels;
    const bundle = new OSC.Bundle([bGetn(bufnum, offset, count)], fireAt);
    transport.send(encode(bundle));
    entry.pendingTickIndex = tickIndex;
  }
}

function emitReply(packet: OscPacket): void {
  if (isMessage(packet)) {
    // Clock /tr intercept: suppress the generic reply, emit clockTick,
    // and kick the read loop for every subscribed bufnum.
    if (
      clockTrigId !== null &&
      packet.address === '/tr' &&
      packet.args[1] === clockTrigId
    ) {
      const tickIndex = (packet.args[2] as number) | 0;
      post({
        type: 'clockTick',
        tick: { tickIndex, receivedAt: performance.now() },
      });
      fireReads(tickIndex);
      return;
    }

    // /b_setn intercept: if the bufnum is subscribed, copy the
    // sample payload into a dedicated Float32Array and post the
    // chunk with zero-copy buffer transfer. Otherwise fall through
    // to the generic reply path so main-thread BufferPokers (Phase 7)
    // still work for non-subscribed bufnums.
    if (packet.address === '/b_setn') {
      const bufnum = packet.args[0] as number;
      const entry = subscriptions.get(bufnum);
      if (entry !== undefined) {
        const count = packet.args[2] as number;
        const data = new Float32Array(count);
        for (let i = 0; i < count; i++) {
          data[i] = packet.args[3 + i] as number;
        }
        const tickIndex = entry.pendingTickIndex ?? -1;
        entry.pendingTickIndex = null;
        post(
          {
            type: 'scopeChunk',
            chunk: {
              scopeId: entry.sub.scopeId,
              data,
              channels: entry.sub.channels,
              tickIndex,
            },
          },
          [data.buffer],
        );
        return;
      }
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
      subscriptions.clear();
      subsByScopeId.clear();
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

    case 'subscribeScope': {
      const { scopeId, bufnum, chunkSize, channels } = msg.subscription;
      console.log(
        `[sc:worker] subscribeScope id=${scopeId} bufnum=${bufnum} ` +
          `chunkSize=${chunkSize} channels=${channels}`,
      );
      const previousBufnum = subsByScopeId.get(scopeId);
      if (previousBufnum !== undefined) {
        subscriptions.delete(previousBufnum);
      }
      subscriptions.set(bufnum, {
        sub: msg.subscription,
        pendingTickIndex: null,
      });
      subsByScopeId.set(scopeId, bufnum);
      return;
    }

    case 'unsubscribeScope': {
      const bufnum = subsByScopeId.get(msg.scopeId);
      if (bufnum === undefined) return;
      console.log(
        `[sc:worker] unsubscribeScope id=${msg.scopeId} bufnum=${bufnum}`,
      );
      subscriptions.delete(bufnum);
      subsByScopeId.delete(msg.scopeId);
      return;
    }
  }
});
