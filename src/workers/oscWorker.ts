/**
 * OSC worker — owns the WebSocket to the bridge. Main thread does
 * the OSC encoding (osc-js via `@sc-app/server-commands`); we just
 * forward bytes either direction. Inbound bytes are decoded here so
 * the main thread receives plain `{ address, args }` POJOs.
 *
 * Tick-driven /b_getn loop: on each `/clock/tick` (Phase 30: the
 * shared clock's SendReply address; replaces the pre-cleanup
 * `/tr` + trigID match) the worker fires a /b_getn for the
 * just-completed half of every subscribed bufnum, matches the
 * resulting /b_setn replies by offset, drains them in tick order,
 * and posts `bufferChunk` events to main.
 *
 * Phase 17 unified the subscription model: one entry per `bufferId`,
 * regardless of whether it backs a scope, a recorder, or a future
 * analyzer. The offset-keyed pending table + tick-ordered reorder
 * buffer + retry policy now apply uniformly. WAV writing and
 * gap-sidecar accounting moved to main (recording's
 * `RecordingController` does it now); the worker is subscription-
 * kind-agnostic and just emits chunks (with `isGap: true` on retry
 * exhaustion).
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
  BufferSubscription,
  MainToWorker,
  OscReply,
  WorkerToMain,
} from '../server/workerProtocol';
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

/** Address-match constant for the shared clock's tick replies.
 *  Phase 30 post-shipping cleanup — the clock SynthDef emits via
 *  `SendReply.kr(tick, '/clock/tick', count)` instead of the
 *  pre-cleanup `SendTrig.kr(tick, 1000, count)`. Worker matches
 *  the address; no registration step from main needed. */
const CLOCK_TICK_ADDRESS = '/clock/tick';

const DEFAULT_RETRY = { maxAttempts: 1, deadlineMs: 50 };

/** One in-flight `/b_getn`, keyed by buffer offset inside the
 *  owning entry's `pendingByOffset`. Two slots max — one per ring
 *  half — so a late tick-N reply can land while a fresh tick-N+1
 *  read at the *other* offset is in flight. */
interface PendingRead {
  tickIndex: number;
  offset: number;
  count: number;
  attempts: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface BufferEntry {
  sub: BufferSubscription;
  /** Skip the next /b_getn fire — set on subscribe (default), cleared
   *  after the first tick passes. Lets the buffer reach a clean half
   *  boundary before we start reading. */
  skipFirstTick: boolean;
  /** Map from buffer-offset (`0` or `chunkSize × channels`) to the
   *  in-flight pending read at that offset. Capacity 2; collisions
   *  mean a tick's read is two ticks behind, treated as a hard gap. */
  pendingByOffset: Map<number, PendingRead>;
  /** Reorder buffer keyed by `tickIndex`. `null` slots mark gaps;
   *  resolved (Float32Array) slots are real chunks. Drains in
   *  `tickIndex` order from `nextDeliverableTick`. */
  reorderBuffer: Map<number, Float32Array | null>;
  /** Next `tickIndex` to deliver. Drains all contiguous tickIndices
   *  from this point each time the buffer receives a new entry. */
  nextDeliverableTick: number;
}

const subscriptions = new Map<string /* bufferId */, BufferEntry>();
/** Reverse index: bufnum → bufferId, for /b_setn dispatch. */
const subsByBufnum = new Map<number, string>();

function clearEntryTimers(entry: BufferEntry): void {
  for (const pending of entry.pendingByOffset.values()) {
    clearTimeout(pending.timeoutHandle);
  }
  entry.pendingByOffset.clear();
}

/** Send `/b_getn` for every subscribed buffer, asking for the half
 *  that just completed at the given tick. Called from the
 *  `/clock/tick` decode path so `tickIndex` is fresh.
 *
 *  Each /b_getn is wrapped in an `OSC.Bundle` with timetag
 *  `Date.now() + READ_DELAY_MS` so scsynth's scheduler holds the
 *  read past the kr-vs-ar drift between the `Impulse.kr`-driven
 *  tick and the `Phasor.ar`-driven `writeIdx`. Without that delay,
 *  some ticks land 1–32 ar samples short of the half-boundary and
 *  the read includes stale tail samples. */
function fireReads(tickIndex: number): void {
  if (!transport || subscriptions.size === 0) return;
  // `Impulse.kr(tickRate, 0)` fires at t=0 (tick 1, audio frame 0),
  // then every `samplesPerTick` ar frames. So tick N fires at frame
  // `(N-1) × samplesPerTick`, and any phasor whose ring length is
  // `2 × samplesPerTick` has just completed half:
  //
  //   N=2 (even): writeIdx = chunkSize  → just finished the first half
  //                                        — read offset 0.
  //   N=3 (odd):  writeIdx = 0          → just finished the second half
  //                                        — read offset chunkSize.
  //
  // So `completedHalf = tickIndex % 2`. Tick 1 reads the (yet-unwritten)
  // second half — the per-entry `skipFirstTick` flag suppresses that
  // first read so the buffer reaches a clean half boundary.
  const completedHalf = tickIndex % 2;
  const fireAt = Date.now() + READ_DELAY_MS;
  for (const entry of subscriptions.values()) {
    fireBufferRead(entry, tickIndex, completedHalf, fireAt);
  }
}

function fireBufferRead(
  entry: BufferEntry,
  tickIndex: number,
  completedHalf: number,
  fireAt: number,
): void {
  if (!transport) return;
  if (entry.skipFirstTick) {
    entry.skipFirstTick = false;
    // Anchor the deliverable-tick pointer at the first read we
    // actually issue. Reads start landing in the reorder buffer
    // indexed by tickIndex; `nextDeliverableTick` is what gates
    // draining.
    entry.nextDeliverableTick = tickIndex + 1;
    return;
  }

  const { channels, chunkSize } = entry.sub;
  const offset = completedHalf * chunkSize * channels;
  const count = chunkSize * channels;

  // Same-offset collision: a previous tick's read at this offset
  // never landed AND its retries are still in flight. That's >2
  // ticks of latency on a single half — declare it a gap and
  // overwrite the slot so we don't leak the timeout. Different-
  // offset overlap is fine and expected: it's exactly what lets a
  // late tick-N reply land while tick-N+1's read at the other
  // offset is in flight.
  const collision = entry.pendingByOffset.get(offset);
  if (collision !== undefined) {
    clearTimeout(collision.timeoutHandle);
    recordGap(entry, collision.tickIndex);
  }

  sendBufferGetn(entry, tickIndex, offset, count, fireAt);
}

function sendBufferGetn(
  entry: BufferEntry,
  tickIndex: number,
  offset: number,
  count: number,
  fireAt: number,
  attempts = 1,
): void {
  if (!transport) return;
  const bundle = new OSC.Bundle(
    [bGetn(entry.sub.bufnum, offset, count)],
    fireAt,
  );
  transport.send(encode(bundle));
  const retry = entry.sub.retry ?? DEFAULT_RETRY;
  const timeoutHandle = setTimeout(
    () => onReadTimeout(entry, offset),
    retry.deadlineMs,
  );
  entry.pendingByOffset.set(offset, {
    tickIndex,
    offset,
    count,
    attempts,
    timeoutHandle,
  });
}

function onReadTimeout(entry: BufferEntry, offset: number): void {
  const pending = entry.pendingByOffset.get(offset);
  if (!pending) return;

  const retry = entry.sub.retry ?? DEFAULT_RETRY;
  if (pending.attempts < retry.maxAttempts) {
    // Re-send: same offset, same count. The closure preserves which
    // offset slot this timeout belongs to so we don't accidentally
    // step on the *other* half's pending read.
    const fireAt = Date.now() + READ_DELAY_MS;
    sendBufferGetn(
      entry,
      pending.tickIndex,
      pending.offset,
      pending.count,
      fireAt,
      pending.attempts + 1,
    );
    return;
  }
  // Retries exhausted — register the gap and let drainReorderBuffer
  // emit it in tick order alongside any chunks that arrived for
  // *later* ticks while this one was failing.
  entry.pendingByOffset.delete(offset);
  recordGap(entry, pending.tickIndex);
}

/** Mark `tickIndex` as a gap. The actual chunk emission happens in
 *  `drainReorderBuffer` so delivery still advances strictly in tick
 *  order, even when a later tick's reply has already arrived. */
function recordGap(entry: BufferEntry, tickIndex: number): void {
  if (entry.reorderBuffer.has(tickIndex)) return;
  entry.reorderBuffer.set(tickIndex, null);
  drainReorderBuffer(entry);
}

/** Emit every contiguous reorder-buffer entry starting at
 *  `nextDeliverableTick`, in tick order, until we hit a tick whose
 *  reply / gap hasn't materialised yet. Each entry produces exactly
 *  one `bufferChunk` event. */
function drainReorderBuffer(entry: BufferEntry): void {
  const { channels, chunkSize, bufferId } = entry.sub;
  while (entry.reorderBuffer.has(entry.nextDeliverableTick)) {
    const tickIndex = entry.nextDeliverableTick;
    const slot = entry.reorderBuffer.get(tickIndex)!;
    entry.reorderBuffer.delete(tickIndex);
    entry.nextDeliverableTick = tickIndex + 1;

    let data: Float32Array;
    let isGap: boolean;
    if (slot === null) {
      // Gap fill — `chunkSize × channels` zeros. Recordings see the
      // `isGap: true` flag and log a sidecar entry; scopes ignore
      // the flag and render silence.
      data = new Float32Array(chunkSize * channels);
      isGap = true;
    } else {
      data = slot;
      isGap = false;
    }

    post(
      {
        type: 'bufferChunk',
        chunk: { bufferId, data, channels, tickIndex, isGap },
      },
      [data.buffer],
    );
  }
}

function emitReply(packet: OscPacket): void {
  if (isMessage(packet)) {
    // Clock tick intercept: suppress the generic reply, emit
    // clockTick, and kick the read loop for every subscribed
    // bufnum. SendReply args are `nodeID replyID value0 …`, so
    // `args[2]` is the PulseCount value.
    if (packet.address === CLOCK_TICK_ADDRESS) {
      const tickIndex = (packet.args[2] as number) | 0;
      post({
        type: 'clockTick',
        tick: { tickIndex, receivedAt: performance.now() },
      });
      fireReads(tickIndex);
      return;
    }

    // /b_setn intercept: dispatch by subscribed bufnum. Non-subscribed
    // bufnums fall through to the generic reply path for any one-shot
    // /b_getn issued from main.
    if (packet.address === '/b_setn') {
      const bufnum = packet.args[0] as number;
      const bufferId = subsByBufnum.get(bufnum);
      if (bufferId !== undefined) {
        const entry = subscriptions.get(bufferId);
        if (entry) {
          handleBufferBSetn(entry, packet);
          return;
        }
      }
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
    // rarely replies with bundles, but some `/done` confirmations and
    // NRT-style responses can arrive this way.
    for (const el of packet.bundleElements) {
      emitReply(el as OscPacket);
    }
  }
}

function handleBufferBSetn(entry: BufferEntry, packet: OSC.Message): void {
  const replyOffset = packet.args[1] as number;
  const count = packet.args[2] as number;

  const pending = entry.pendingByOffset.get(replyOffset);
  if (!pending) {
    // Stale reply — most likely a retry that landed after the gap
    // was already booked, or an out-of-band /b_setn (e.g. an OSC
    // console QueryTree probe firing on this bufnum). Discarding is
    // safe because either the gap is already in the reorder buffer
    // or the subscription doesn't care about this offset.
    return;
  }

  clearTimeout(pending.timeoutHandle);
  entry.pendingByOffset.delete(replyOffset);

  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = packet.args[3 + i] as number;
  }
  // Don't post directly — the chunk goes into the reorder buffer
  // keyed by tickIndex, and `drainReorderBuffer` emits in strict
  // tick order. This way an out-of-order arrival (e.g. tick N+1's
  // reply landing before tick N's late retry) waits until the gap
  // or the late chunk for tick N has been resolved.
  entry.reorderBuffer.set(pending.tickIndex, samples);
  drainReorderBuffer(entry);
}

setWorkerMessageHandler(async (msg: MainToWorker) => {
  // Per-message log was useful during transport bring-up but spams
  // DebugLog at runtime (every /b_getn, every clock tick, every
  // status heartbeat). Branches below still log structurally
  // significant events (connect, disconnect, errors).
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
      // Clear any pending timers so they don't fire after teardown
      // and try to re-send through a closed transport.
      for (const entry of subscriptions.values()) {
        clearEntryTimers(entry);
      }
      subscriptions.clear();
      subsByBufnum.clear();
      if (transport) {
        await transport.close();
        transport = null;
      }
      return;
    }

    case 'subscribeBuffer': {
      const sub = msg.subscription;
      console.log(
        `[sc:worker] subscribeBuffer id=${sub.bufferId} bufnum=${sub.bufnum} ` +
          `chunkSize=${sub.chunkSize} channels=${sub.channels}`,
      );
      // Replace any existing subscription with the same bufferId —
      // duplicate subscribes typically mean the consumer restarted.
      const stale = subscriptions.get(sub.bufferId);
      if (stale) {
        clearEntryTimers(stale);
        subsByBufnum.delete(stale.sub.bufnum);
      }
      subscriptions.set(sub.bufferId, {
        sub,
        skipFirstTick: sub.skipFirstTick ?? true,
        pendingByOffset: new Map(),
        reorderBuffer: new Map(),
        nextDeliverableTick: 0,
      });
      subsByBufnum.set(sub.bufnum, sub.bufferId);
      return;
    }

    case 'unsubscribeBuffer': {
      const entry = subscriptions.get(msg.bufferId);
      if (!entry) return;
      console.log(
        `[sc:worker] unsubscribeBuffer id=${msg.bufferId} bufnum=${entry.sub.bufnum}`,
      );
      clearEntryTimers(entry);
      subscriptions.delete(msg.bufferId);
      subsByBufnum.delete(entry.sub.bufnum);
      return;
    }
  }
});
