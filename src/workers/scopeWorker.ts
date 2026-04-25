/**
 * Scope worker — owns the WebSocket to the bridge. Main thread does
 * the OSC encoding (osc-js via `@sc-app/server-commands`); we just
 * forward bytes either direction. Inbound bytes are decoded here so
 * the main thread receives plain `{ address, args }` POJOs.
 *
 * Phase 8 added a tick-driven read loop for subscribed scope buffers:
 * on each clock tick the worker fires `/b_getn` for the just-completed
 * half of every subscribed bufnum, and routes the matching `/b_setn`
 * replies back to main as zero-copy `scopeChunk` events.
 *
 * Phase 12 generalises that loop into a tagged-union subscription
 * table: scope entries route /b_setn payloads to the renderer as
 * before; recording entries append samples to an in-memory
 * `WavMemoryWriter`, with a per-tick retry/timeout pipeline that
 * fills missing reads with zeros and emits gap notifications.
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
  RecordingSubscription,
  ScopeSubscription,
  WorkerToMain,
} from '../scope/workerProtocol';
import { createOscTransport, type OscTransport } from './transport';
import { WavMemoryWriter } from './wavWriter';

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

/** Common state shared by both subscription kinds — the bufnum-keyed
 *  pending read tag plus a discriminator. */
interface ScopeEntry {
  kind: 'scope';
  sub: ScopeSubscription;
  /** Tick the most recent `/b_getn` was sent under, or null if no
   *  read in flight. Stamped onto the dispatched `scopeChunk`. */
  pendingTickIndex: number | null;
}

/** Tracks one in-flight `/b_getn` for a recording entry, including
 *  retry state. Stored in `RecordingEntry.pendingByOffset` keyed by
 *  the read's sample-frame offset so two reads at *different* offsets
 *  (the two halves of the ring) can coexist in flight when the
 *  network occasionally takes longer than `tickIntervalMs` to round
 *  trip — without that, every late reply bumped into the next tick's
 *  pendingRead slot and got discarded. */
interface RecordingPendingRead {
  tickIndex: number;
  offset: number;
  count: number;
  attempts: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface RecordingEntry {
  kind: 'recording';
  sub: RecordingSubscription;
  writer: WavMemoryWriter;
  /** When true, the worker silently skips firing a `/b_getn` on the
   *  next tick. Lets the recorder's local-state phasor settle on a
   *  half boundary before we start reading. Cleared on the first
   *  tick observed. */
  skipFirstTick: boolean;
  /** Map from buffer offset (0 = first half, samplesPerTick × channels
   *  = second half) to the in-flight pending read at that offset.
   *  Two slots max; collisions on the same offset mean a tick's read
   *  is two ticks behind, which we treat as a hard gap. */
  pendingByOffset: Map<number, RecordingPendingRead>;
  /** Reorder buffer keyed by `tickIndex`. Replies can arrive out of
   *  order across the two offsets; we hold them here and drain in
   *  tick order so the WAV stays linear. `null` entries mark gaps
   *  whose zero-fill is owed to the WAV when their tick is next. */
  reorderBuffer: Map<number, Float32Array | null>;
  /** Next `tickIndex` we're going to append to the WAV. Drains all
   *  contiguous tickIndices from this point each time the buffer
   *  receives a new entry. */
  nextTickToWrite: number;
  /** Audited gap log shipped back as a `.gaps.json` sidecar. Filled
   *  in tick order alongside the WAV writes. */
  gaps: Array<{ tickIndex: number; framesMissing: number }>;
  /** True after `stopRecording` is received — suppresses any further
   *  read issuance / gap accounting until the worker fully unwinds. */
  stopping: boolean;
}

type SubscriptionEntry = ScopeEntry | RecordingEntry;

const subscriptions = new Map<number /* bufnum */, SubscriptionEntry>();
const subsByScopeId = new Map<string, number /* bufnum */>();
const subsByRecordingId = new Map<string, number /* bufnum */>();

/** Send `/b_getn` for every subscribed bufnum, asking for the half
 *  that just completed at the given tick. Must be called from the
 *  `/tr` decode path so `tickIndex` is fresh.
 *
 *  Each `/b_getn` is wrapped in an `OSC.Bundle` with timetag
 *  `Date.now() + READ_DELAY_MS` so scsynth's scheduler holds the
 *  read until past the kr-vs-ar drift between the `Impulse.kr`-driven
 *  `/tr` and the `Phasor.ar`-driven `writeIdx`. Without this delay,
 *  some ticks land 1–32 ar samples short of the half-boundary and
 *  the read includes stale samples from the previous cycle. */
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
  // second half — for scopes that's a one-time silent chunk; for
  // recordings the per-entry `skipFirstTick` flag suppresses the read.
  const completedHalf = tickIndex % 2;
  const fireAt = Date.now() + READ_DELAY_MS;
  for (const entry of subscriptions.values()) {
    if (entry.kind === 'scope') {
      fireScopeRead(entry, tickIndex, completedHalf, fireAt);
    } else {
      fireRecordingRead(entry, tickIndex, completedHalf);
    }
  }
}

function fireScopeRead(
  entry: ScopeEntry,
  tickIndex: number,
  completedHalf: number,
  fireAt: number,
): void {
  if (!transport) return;
  const { bufnum, chunkSize, channels } = entry.sub;
  const offset = completedHalf * chunkSize * channels;
  const count = chunkSize * channels;
  const bundle = new OSC.Bundle([bGetn(bufnum, offset, count)], fireAt);
  transport.send(encode(bundle));
  entry.pendingTickIndex = tickIndex;
}

function fireRecordingRead(
  entry: RecordingEntry,
  tickIndex: number,
  completedHalf: number,
): void {
  if (!transport) return;
  if (entry.stopping) return;

  if (entry.skipFirstTick) {
    entry.skipFirstTick = false;
    // Anchor the WAV's first tick at the first read we actually
    // issue. Reads start landing in the reorder buffer indexed by
    // tickIndex, and `nextTickToWrite` is what gates draining.
    entry.nextTickToWrite = tickIndex + 1;
    return;
  }

  const { channels, samplesPerTick } = entry.sub;
  const offset = completedHalf * samplesPerTick * channels;
  const count = samplesPerTick * channels;

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

  sendRecordingGetn(entry, tickIndex, offset, count);
}

function sendRecordingGetn(
  entry: RecordingEntry,
  tickIndex: number,
  offset: number,
  count: number,
  attempts = 1,
): void {
  if (!transport) return;
  transport.send(encode(bGetn(entry.sub.bufnum, offset, count)));
  const timeoutHandle = setTimeout(
    () => onRecordingReadTimeout(entry, offset),
    entry.sub.retry.deadlineMs,
  );
  entry.pendingByOffset.set(offset, {
    tickIndex,
    offset,
    count,
    attempts,
    timeoutHandle,
  });
}

function onRecordingReadTimeout(
  entry: RecordingEntry,
  offset: number,
): void {
  if (entry.stopping) return;
  const pending = entry.pendingByOffset.get(offset);
  if (!pending) return;

  if (pending.attempts < entry.sub.retry.maxAttempts) {
    // Re-send: same offset, same count. The closure preserves which
    // offset slot this timeout belongs to so we don't accidentally
    // step on the *other* half's pending read.
    sendRecordingGetn(
      entry,
      pending.tickIndex,
      pending.offset,
      pending.count,
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

/** Mark `tickIndex` as a gap. The actual zero-fill + WAV append + UI
 *  notification happens in `drainReorderBuffer` so the WAV's
 *  framesWritten still advances strictly in tick order, even when a
 *  later tick's reply has already arrived. */
function recordGap(entry: RecordingEntry, tickIndex: number): void {
  if (entry.reorderBuffer.has(tickIndex)) return;
  entry.reorderBuffer.set(tickIndex, null);
  drainReorderBuffer(entry);
}

/** Append every contiguous reorder-buffer entry starting at
 *  `nextTickToWrite`, in tick order, until we hit a tick whose
 *  reply / gap hasn't materialised yet. Each entry produces exactly
 *  one `recordingChunkWritten` notification (and a `recordingGap`
 *  for the null slots). */
function drainReorderBuffer(entry: RecordingEntry): void {
  const { samplesPerTick, channels } = entry.sub;
  while (entry.reorderBuffer.has(entry.nextTickToWrite)) {
    const tickIndex = entry.nextTickToWrite;
    const chunk = entry.reorderBuffer.get(tickIndex)!;
    entry.reorderBuffer.delete(tickIndex);
    entry.nextTickToWrite = tickIndex + 1;

    if (chunk === null) {
      // Gap: write `samplesPerTick × channels` zeros so wall-clock
      // position stays linear.
      const zeros = new Float32Array(samplesPerTick * channels);
      entry.writer.append(zeros);
      entry.gaps.push({ tickIndex, framesMissing: samplesPerTick });
      post({
        type: 'recordingGap',
        gap: {
          recordingId: entry.sub.recordingId,
          tickIndex,
          framesMissing: samplesPerTick,
        },
      });
    } else {
      entry.writer.append(chunk);
    }
    post({
      type: 'recordingChunkWritten',
      info: {
        recordingId: entry.sub.recordingId,
        tickIndex,
        framesWritten: entry.writer.framesWritten,
      },
    });
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

    // /b_setn intercept: dispatch by subscription kind. Non-subscribed
    // bufnums fall through to the generic reply path so main-thread
    // BufferPokers (Phase 7) still work.
    if (packet.address === '/b_setn') {
      const entry = subscriptions.get(packet.args[0] as number);
      if (entry !== undefined) {
        if (entry.kind === 'scope') {
          handleScopeBSetn(entry, packet);
        } else {
          handleRecordingBSetn(entry, packet);
        }
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

function handleScopeBSetn(entry: ScopeEntry, packet: OSC.Message): void {
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
}

function handleRecordingBSetn(
  entry: RecordingEntry,
  packet: OSC.Message,
): void {
  if (entry.stopping) return;
  const replyOffset = packet.args[1] as number;
  const count = packet.args[2] as number;

  const pending = entry.pendingByOffset.get(replyOffset);
  if (!pending) {
    // Stale reply — most likely a retry that landed after the gap
    // was already booked, or an out-of-band /b_setn (BufferPoker
    // against this bufnum etc.). Discarding is safe because either
    // the gap is already in the reorder buffer or the recording
    // doesn't care about this offset.
    return;
  }

  clearTimeout(pending.timeoutHandle);
  entry.pendingByOffset.delete(replyOffset);

  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = packet.args[3 + i] as number;
  }
  // Don't append directly to the writer — the chunk goes into the
  // reorder buffer keyed by tickIndex, and `drainReorderBuffer`
  // appends in strict tick order. This way an out-of-order arrival
  // (e.g. tick N+1's reply landing before tick N's late retry) waits
  // until the gap or the late chunk for tick N has been resolved.
  entry.reorderBuffer.set(pending.tickIndex, samples);
  drainReorderBuffer(entry);
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
      // Clear any pending recording timers so they don't fire after
      // teardown and try to re-send through a closed transport.
      for (const entry of subscriptions.values()) {
        if (entry.kind === 'recording') {
          for (const pending of entry.pendingByOffset.values()) {
            clearTimeout(pending.timeoutHandle);
          }
          entry.pendingByOffset.clear();
        }
      }
      subscriptions.clear();
      subsByScopeId.clear();
      subsByRecordingId.clear();
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
        kind: 'scope',
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

    case 'startRecording': {
      const sub = msg.subscription;
      console.log(
        `[sc:worker] startRecording id=${sub.recordingId} bufnum=${sub.bufnum} ` +
          `channels=${sub.channels} samplesPerTick=${sub.samplesPerTick}`,
      );
      const previousBufnum = subsByRecordingId.get(sub.recordingId);
      if (previousBufnum !== undefined) {
        const stale = subscriptions.get(previousBufnum);
        if (stale && stale.kind === 'recording') {
          for (const pending of stale.pendingByOffset.values()) {
            clearTimeout(pending.timeoutHandle);
          }
          stale.pendingByOffset.clear();
        }
        subscriptions.delete(previousBufnum);
      }
      const writer = new WavMemoryWriter({
        sampleRate: sub.sampleRate,
        channels: sub.channels,
      });
      const entry: RecordingEntry = {
        kind: 'recording',
        sub,
        writer,
        skipFirstTick: true,
        pendingByOffset: new Map(),
        reorderBuffer: new Map(),
        nextTickToWrite: 0,
        gaps: [],
        stopping: false,
      };
      subscriptions.set(sub.bufnum, entry);
      subsByRecordingId.set(sub.recordingId, sub.bufnum);
      return;
    }

    case 'stopRecording': {
      const bufnum = subsByRecordingId.get(msg.recordingId);
      if (bufnum === undefined) {
        console.warn(
          `[sc:worker] stopRecording for unknown id=${msg.recordingId}`,
        );
        return;
      }
      const entry = subscriptions.get(bufnum);
      if (!entry || entry.kind !== 'recording') {
        console.warn(
          `[sc:worker] stopRecording: entry for bufnum ${bufnum} is not a recording`,
        );
        return;
      }
      console.log(
        `[sc:worker] stopRecording id=${msg.recordingId} bufnum=${bufnum} ` +
          `frames=${entry.writer.framesWritten} gaps=${entry.gaps.length}`,
      );
      entry.stopping = true;
      // Reads issued after the recorder synth was /n_free'd will
      // never come back. Drop them silently rather than accounting
      // them as gaps. Likewise drop anything still in the reorder
      // buffer beyond `nextTickToWrite` — the WAV's tail is wherever
      // it landed when stop was called.
      for (const pending of entry.pendingByOffset.values()) {
        clearTimeout(pending.timeoutHandle);
      }
      entry.pendingByOffset.clear();
      entry.reorderBuffer.clear();
      subscriptions.delete(bufnum);
      subsByRecordingId.delete(msg.recordingId);

      const wav = entry.writer.finalise();
      const gaps = entry.gaps.slice();
      const gapsJson =
        gaps.length > 0
          ? JSON.stringify(
              {
                recordingId: msg.recordingId,
                gaps,
              },
              null,
              2,
            )
          : '';
      post(
        {
          type: 'recordingDone',
          done: {
            recordingId: msg.recordingId,
            totalFrames: entry.writer.framesWritten,
            gaps,
            wav,
            gapsJson,
          },
        },
        [wav],
      );
      return;
    }
  }
});
