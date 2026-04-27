/**
 * Main-thread wrapper around the OSC worker.
 *
 * Surface:
 * - `sendCommand(msg)`            — fire-and-forget OSC message/bundle.
 * - `onReply(cb)`                 — subscribe to decoded OSC replies
 *   (plain `{ address, args }` POJOs; postMessage strips class methods).
 * - `onError(cb)`                 — worker/WS error stream.
 * - `onTick(cb)`                  — decoded clock ticks (gated by
 *   `registerClock(trigId)`).
 * - `sendAndAwaitReply(msg, match, timeoutMs)` — send + await first
 *   matching reply.
 * - `sendAndSync(msg, timeoutMs)` — send + /sync + await /synced.
 * - `sendCommandAndAwaitSync(buildMsg, timeoutMs)` — atomic variant
 *   for commands with an embedded `/sync` (e.g. `/d_recv`'s
 *   `completionMsg`).
 */

import type OSCClass from 'osc-js';
import {
  encode,
  sync as syncMsg,
  Synced,
  type OscPacket,
} from '@sc-app/server-commands';

import type {
  ClockTick,
  MainToWorker,
  OscReply,
  RecordingChunkWritten,
  RecordingDone,
  RecordingGap,
  RecordingSubscription,
  ScopeChunk,
  ScopeSubscription,
  WorkerToMain,
} from './workerProtocol';

const READY_TIMEOUT_MS = 3000;
const DEFAULT_SYNC_TIMEOUT_MS = 2000;

export type ReplyListener = (reply: OscReply) => void;
export type ErrorListener = (message: string) => void;
export type TickListener = (tick: ClockTick) => void;
export type ChunkListener = (chunk: ScopeChunk) => void;
export type ReplyMatcher = (reply: OscReply) => boolean;
export type RecordingChunkListener = (info: RecordingChunkWritten) => void;
export type RecordingGapListener = (gap: RecordingGap) => void;
export type RecordingDoneListener = (done: RecordingDone) => void;

export class WorkerClient {
  private readonly worker: Worker;
  private readonly replyListeners = new Set<ReplyListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly tickListeners = new Set<TickListener>();
  private readonly chunkListeners = new Map<string, Set<ChunkListener>>();
  private readonly recordingChunkListeners = new Map<
    string,
    Set<RecordingChunkListener>
  >();
  private readonly recordingGapListeners = new Map<
    string,
    Set<RecordingGapListener>
  >();
  private readonly recordingDoneListeners = new Map<
    string,
    Set<RecordingDoneListener>
  >();
  private nextSyncId = 1;
  readonly ready: Promise<void>;

  /** `url` is the full WS URL including the `?scsynth=HOST:PORT` param. */
  constructor(url: string) {
    console.log('[sc:client] constructing WorkerClient', url);
    this.worker = new Worker(
      new URL('../workers/oscWorker.ts', import.meta.url),
      { type: 'module' },
    );

    this.worker.addEventListener('error', (ev) => {
      const message =
        ev.message || `worker module error at ${ev.filename}:${ev.lineno}:${ev.colno}`;
      console.error('[sc:client] worker error', ev, { message });
      for (const cb of this.errorListeners) cb(message);
    });
    this.worker.addEventListener('messageerror', (ev) => {
      console.error('[sc:client] messageerror', ev);
      for (const cb of this.errorListeners) cb('worker messageerror (uncloneable payload)');
    });

    this.ready = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `worker/WS did not become ready within ${READY_TIMEOUT_MS} ms ` +
              `(open DevTools → Application → Workers to inspect the OSC worker)`,
          ),
        );
      }, READY_TIMEOUT_MS);

      const handleReady = (ev: MessageEvent<WorkerToMain>) => {
        if (ev.data.type === 'ready') {
          console.log('[sc:client] ready ✓');
          cleanup();
          resolve();
        } else if (ev.data.type === 'error') {
          console.error('[sc:client] handshake failed:', ev.data.message);
          cleanup();
          reject(new Error(ev.data.message));
        }
      };
      const handleErrorEvent = (ev: ErrorEvent) => {
        console.error('[sc:client] worker error event during handshake', ev);
        cleanup();
        reject(
          new Error(
            ev.message || `worker module crashed at ${ev.filename}:${ev.lineno}`,
          ),
        );
      };

      const cleanup = () => {
        window.clearTimeout(timeout);
        this.worker.removeEventListener('message', handleReady);
        this.worker.removeEventListener('error', handleErrorEvent);
      };

      this.worker.addEventListener('message', handleReady);
      this.worker.addEventListener('error', handleErrorEvent);
    });

    this.worker.addEventListener('message', (ev: MessageEvent<WorkerToMain>) => {
      const msg = ev.data;
      switch (msg.type) {
        case 'reply':
          console.log('[sc:client] reply', msg.reply.address);
          for (const cb of this.replyListeners) cb(msg.reply);
          break;
        case 'clockTick':
          for (const cb of this.tickListeners) cb(msg.tick);
          break;
        case 'scopeChunk': {
          const cbs = this.chunkListeners.get(msg.chunk.scopeId);
          if (cbs) {
            for (const cb of cbs) cb(msg.chunk);
          }
          // No listener registered → drop on the floor; the worker
          // already paid the cost of decoding, but holding onto an
          // orphan chunk would just leak the Float32Array.
          break;
        }
        case 'recordingChunkWritten': {
          const cbs = this.recordingChunkListeners.get(msg.info.recordingId);
          if (cbs) for (const cb of cbs) cb(msg.info);
          break;
        }
        case 'recordingGap': {
          const cbs = this.recordingGapListeners.get(msg.gap.recordingId);
          if (cbs) for (const cb of cbs) cb(msg.gap);
          break;
        }
        case 'recordingDone': {
          const cbs = this.recordingDoneListeners.get(msg.done.recordingId);
          if (cbs) for (const cb of cbs) cb(msg.done);
          break;
        }
        case 'error':
          console.warn('[sc:client] error', msg.message);
          for (const cb of this.errorListeners) cb(msg.message);
          break;
        case 'log': {
          const target =
            msg.level === 'error' ? console.error
              : msg.level === 'warn' ? console.warn
                : msg.level === 'info' ? console.info
                  : console.log;
          target(msg.message);
          break;
        }
      }
    });

    console.log('[sc:client] posting connect');
    this.post({ type: 'connect', url });
  }

  /** Encode and ship one message or bundle. */
  sendCommand(packet: OscPacket): void {
    const bytes = encode(packet);
    this.post({ type: 'send', bytes });
  }

  onReply(cb: ReplyListener): () => void {
    this.replyListeners.add(cb);
    return () => this.replyListeners.delete(cb) as unknown as void;
  }

  onError(cb: ErrorListener): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb) as unknown as void;
  }

  /** Subscribe to decoded clock ticks. Only fires while a clock
   *  trigId is registered via `registerClock`. */
  onTick(cb: TickListener): () => void {
    this.tickListeners.add(cb);
    return () => this.tickListeners.delete(cb) as unknown as void;
  }

  /** Tell the worker which `/tr` triggerId is the clock — matching
   *  replies are suppressed from `onReply` and emitted via `onTick`. */
  registerClock(trigId: number): void {
    this.post({ type: 'registerClock', trigId });
  }

  unregisterClock(): void {
    this.post({ type: 'unregisterClock' });
  }

  /** Register a per-scope tick-driven read on the worker's
   *  subscription table and route the resulting `scopeChunk` events
   *  to `cb`. Returns the unsubscribe function — pair every call
   *  with the cleanup it returns. Calling twice with the same
   *  `scopeId` replaces the previous subscription on the worker
   *  side and adds a second callback. */
  subscribeScope(
    sub: ScopeSubscription,
    cb: ChunkListener,
  ): () => void {
    this.post({ type: 'subscribeScope', subscription: sub });
    let cbs = this.chunkListeners.get(sub.scopeId);
    if (!cbs) {
      cbs = new Set();
      this.chunkListeners.set(sub.scopeId, cbs);
    }
    cbs.add(cb);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      const set = this.chunkListeners.get(sub.scopeId);
      if (set) {
        set.delete(cb);
        if (set.size === 0) {
          this.chunkListeners.delete(sub.scopeId);
          this.post({ type: 'unsubscribeScope', scopeId: sub.scopeId });
        }
      }
    };
  }

  /** Register a recording with the worker — it'll start firing
   *  `/b_getn` at every tick and accumulating samples into a private
   *  in-memory `WavMemoryWriter`. Pair every call with
   *  `stopRecording(recordingId)` to drain and finalise the WAV.
   *
   *  `onChunk` / `onGap` fire as samples land or gaps are filled;
   *  `onDone` fires exactly once after `stopRecording`. The returned
   *  function clears all three listener sets — invoke it to detach
   *  before the controller is garbage-collected. */
  subscribeRecording(
    sub: RecordingSubscription,
    callbacks: {
      onChunk?: RecordingChunkListener;
      onGap?: RecordingGapListener;
      onDone?: RecordingDoneListener;
    },
  ): () => void {
    this.post({ type: 'startRecording', subscription: sub });
    if (callbacks.onChunk) {
      const set =
        this.recordingChunkListeners.get(sub.recordingId) ?? new Set();
      set.add(callbacks.onChunk);
      this.recordingChunkListeners.set(sub.recordingId, set);
    }
    if (callbacks.onGap) {
      const set = this.recordingGapListeners.get(sub.recordingId) ?? new Set();
      set.add(callbacks.onGap);
      this.recordingGapListeners.set(sub.recordingId, set);
    }
    if (callbacks.onDone) {
      const set =
        this.recordingDoneListeners.get(sub.recordingId) ?? new Set();
      set.add(callbacks.onDone);
      this.recordingDoneListeners.set(sub.recordingId, set);
    }
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      const cb = callbacks;
      const ck = this.recordingChunkListeners.get(sub.recordingId);
      if (ck && cb.onChunk) {
        ck.delete(cb.onChunk);
        if (ck.size === 0) this.recordingChunkListeners.delete(sub.recordingId);
      }
      const gp = this.recordingGapListeners.get(sub.recordingId);
      if (gp && cb.onGap) {
        gp.delete(cb.onGap);
        if (gp.size === 0) this.recordingGapListeners.delete(sub.recordingId);
      }
      const dn = this.recordingDoneListeners.get(sub.recordingId);
      if (dn && cb.onDone) {
        dn.delete(cb.onDone);
        if (dn.size === 0) this.recordingDoneListeners.delete(sub.recordingId);
      }
    };
  }

  /** Tell the worker to drain the named recording, finalise the WAV,
   *  and post a `recordingDone`. Idempotent — repeated calls after
   *  the first go through to the worker which warns and ignores. */
  stopRecording(recordingId: string): void {
    this.post({ type: 'stopRecording', recordingId });
  }

  /** Send `msg` and resolve on the first reply satisfying `match`. */
  sendAndAwaitReply(
    msg: OscPacket,
    match: ReplyMatcher,
    timeoutMs = DEFAULT_SYNC_TIMEOUT_MS,
  ): Promise<OscReply> {
    return new Promise((resolve, reject) => {
      const offReply = this.onReply((reply) => {
        if (!match(reply)) return;
        cleanup();
        resolve(reply);
      });
      const offError = this.onError((message) => {
        cleanup();
        reject(new Error(message));
      });
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error(`timed out after ${timeoutMs} ms waiting for reply`));
      }, timeoutMs);
      const cleanup = () => {
        window.clearTimeout(timer);
        offReply();
        offError();
      };
      this.sendCommand(msg);
    });
  }

  /** Send `msg`, then `/sync` with a fresh id; resolve when the matching
   *  `/synced` arrives. Use for commands with no reply of their own. */
  sendAndSync(msg: OscPacket, timeoutMs = DEFAULT_SYNC_TIMEOUT_MS): Promise<void> {
    const syncId = this.nextSyncId++;
    return new Promise((resolve, reject) => {
      const offReply = this.onReply((reply) => {
        if (reply.address !== Synced.address) return;
        if (Synced.syncId(reply as unknown as OSCClass.Message) !== syncId) return;
        cleanup();
        resolve();
      });
      const offError = this.onError((message) => {
        cleanup();
        reject(new Error(message));
      });
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error(`sendAndSync(${syncId}) timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      const cleanup = () => {
        window.clearTimeout(timer);
        offReply();
        offError();
      };
      this.sendCommand(msg);
      this.sendCommand(syncMsg(syncId));
    });
  }

  /** Send a command that itself embeds a `/sync` (e.g. `/d_recv`'s
   *  `completionMsg`), then resolve when the matching `/synced`
   *  arrives. Atomic variant of `sendAndSync`. */
  sendCommandAndAwaitSync(
    buildMsg: (syncId: number) => OscPacket,
    timeoutMs = DEFAULT_SYNC_TIMEOUT_MS,
  ): Promise<void> {
    const syncId = this.nextSyncId++;
    return new Promise((resolve, reject) => {
      const offReply = this.onReply((reply) => {
        if (reply.address !== Synced.address) return;
        if (Synced.syncId(reply as unknown as OSCClass.Message) !== syncId) return;
        cleanup();
        resolve();
      });
      const offError = this.onError((message) => {
        cleanup();
        reject(new Error(message));
      });
      const timer = window.setTimeout(() => {
        cleanup();
        reject(
          new Error(
            `sendCommandAndAwaitSync(${syncId}) timed out after ${timeoutMs} ms`,
          ),
        );
      }, timeoutMs);
      const cleanup = () => {
        window.clearTimeout(timer);
        offReply();
        offError();
      };
      this.sendCommand(buildMsg(syncId));
    });
  }

  dispose(): void {
    this.post({ type: 'disconnect' });
    this.worker.terminate();
    this.replyListeners.clear();
    this.errorListeners.clear();
    this.tickListeners.clear();
    this.chunkListeners.clear();
    this.recordingChunkListeners.clear();
    this.recordingGapListeners.clear();
    this.recordingDoneListeners.clear();
  }

  private post(msg: MainToWorker): void {
    this.worker.postMessage(msg);
  }
}
