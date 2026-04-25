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
 *  retry state. Replaced by null once a matching `/b_setn` lands or
 *  the gap path runs. */
interface RecordingPendingRead {
  tickIndex: number;
  /** Sample-frame offset on the buffer this read was issued for.
   *  Cross-checked against incoming `/b_setn` so a stale (post-retry)
   *  reply can't double-count. */
  offset: number;
  /** Word count requested = `samplesPerTick × channels`. */
  count: number;
  attempts: number;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface RecordingEntry {
  kind: 'recording';
  sub: RecordingSubscription;
  writer: WavMemoryWriter;
  /** When true, the worker silently skips firing a `/b_getn` on the
   *  next tick. Lets the recorder's `Phasor.ar` (which starts at 0
   *  the moment /s_new fires) accumulate one full half before we
   *  start reading. Cleared on the first tick observed. */
  skipFirstTick: boolean;
  pendingRead: RecordingPendingRead | null;
  /** Audited gap log shipped back as a `.gaps.json` sidecar. */
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

  // If we still have a pendingRead from the previous tick when a new
  // tick arrives, the previous read missed even after retries —
  // declare a gap and move on so we never have two reads in flight
  // for the same bufnum (scsynth reply matching is by bufnum +
  // offset; two reads at *different* offsets are safe but messy).
  if (entry.pendingRead !== null) {
    clearTimeout(entry.pendingRead.timeoutHandle);
    finishGap(entry, entry.pendingRead.tickIndex);
  }

  if (entry.skipFirstTick) {
    entry.skipFirstTick = false;
    return;
  }

  const { channels, samplesPerTick } = entry.sub;
  const offset = completedHalf * samplesPerTick * channels;
  const count = samplesPerTick * channels;
  // No bundle / READ_DELAY_MS for recordings: the recorder's
  // Phasor.ar isn't aligned to the global clockBus, so the kr-vs-ar
  // race the scope path mitigates doesn't directly apply. Adding
  // delay here would just push every retry deadline closer to the
  // next tick boundary — wait until we see actual artefacts before
  // re-introducing it.
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
    () => onRecordingReadTimeout(entry),
    entry.sub.retry.deadlineMs,
  );
  entry.pendingRead = {
    tickIndex,
    offset,
    count,
    attempts,
    timeoutHandle,
  };
}

function onRecordingReadTimeout(entry: RecordingEntry): void {
  if (entry.stopping || entry.pendingRead === null) return;
  const pending = entry.pendingRead;
  if (pending.attempts < entry.sub.retry.maxAttempts) {
    // Re-send — same bufnum, same offset, same count.
    sendRecordingGetn(
      entry,
      pending.tickIndex,
      pending.offset,
      pending.count,
      pending.attempts + 1,
    );
    return;
  }
  finishGap(entry, pending.tickIndex);
}

/** Write `samplesPerTick × channels` zeros to the WAV (so wall-clock
 *  position stays linear), record the gap in the audit log, post a
 *  notification to main, and clear `pendingRead`. */
function finishGap(entry: RecordingEntry, tickIndex: number): void {
  const { samplesPerTick, channels } = entry.sub;
  const framesMissing = samplesPerTick;
  const zeros = new Float32Array(samplesPerTick * channels); // zeroed by spec
  entry.writer.append(zeros);
  entry.gaps.push({ tickIndex, framesMissing });
  entry.pendingRead = null;
  post({
    type: 'recordingGap',
    gap: {
      recordingId: entry.sub.recordingId,
      tickIndex,
      framesMissing,
    },
  });
  // After a gap we still notify "framesWritten advanced" so the UI's
  // elapsed counter doesn't freeze.
  post({
    type: 'recordingChunkWritten',
    info: {
      recordingId: entry.sub.recordingId,
      tickIndex,
      framesWritten: entry.writer.framesWritten,
    },
  });
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

  if (entry.pendingRead === null) {
    // Stale reply (e.g. retry succeeded after we declared the gap).
    // Discard — the WAV already has zeros for that tick.
    console.warn(
      `[sc:worker] /b_setn for recording ${entry.sub.recordingId} with no pendingRead`,
    );
    return;
  }
  if (replyOffset !== entry.pendingRead.offset) {
    // Out-of-band /b_setn (BufferPoker against same bufnum, or an
    // exotic timing race). Ignore so we don't poison the WAV.
    console.warn(
      `[sc:worker] /b_setn offset mismatch for ${entry.sub.recordingId}: ` +
        `got ${replyOffset}, expected ${entry.pendingRead.offset}`,
    );
    return;
  }

  clearTimeout(entry.pendingRead.timeoutHandle);
  const tickIndex = entry.pendingRead.tickIndex;
  entry.pendingRead = null;

  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = packet.args[3 + i] as number;
  }
  entry.writer.append(samples);
  post({
    type: 'recordingChunkWritten',
    info: {
      recordingId: entry.sub.recordingId,
      tickIndex,
      framesWritten: entry.writer.framesWritten,
    },
  });
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
        if (entry.kind === 'recording' && entry.pendingRead !== null) {
          clearTimeout(entry.pendingRead.timeoutHandle);
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
        if (stale && stale.kind === 'recording' && stale.pendingRead) {
          clearTimeout(stale.pendingRead.timeoutHandle);
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
        pendingRead: null,
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
      if (entry.pendingRead !== null) {
        // Reads issued after the recorder synth was /n_free'd will
        // never come back. Don't account them as gaps — silent drop.
        clearTimeout(entry.pendingRead.timeoutHandle);
        entry.pendingRead = null;
      }
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
