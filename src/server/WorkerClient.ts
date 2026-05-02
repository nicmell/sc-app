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
 * - `subscribeBuffer(sub, cb)`    — register a tick-driven /b_getn
 *   loop on the worker; chunk replies fan out to one or more
 *   main-side listeners on the same `bufferId`.
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
  BufferChunk,
  BufferSubscription,
  ClockTick,
  MainToWorker,
  OscError,
  OscReply,
  WorkerToMain,
} from './workerProtocol';

const READY_TIMEOUT_MS = 3000;
const DEFAULT_SYNC_TIMEOUT_MS = 2000;

export type ReplyListener = (reply: OscReply) => void;
export type ErrorListener = (message: string) => void;
export type OscErrorListener = (error: OscError) => void;
export type TickListener = (tick: ClockTick) => void;
export type BufferChunkListener = (chunk: BufferChunk) => void;
export type ReplyMatcher = (reply: OscReply) => boolean;

/** Returned from `subscribeBuffer`. Call `unsubscribe()` when done —
 *  removes the local listener; if it was the last listener for this
 *  `bufferId`, posts an `unsubscribeBuffer` to the worker so its
 *  read loop drops the entry. */
export interface BufferSubscriptionHandle {
  unsubscribe: () => void;
}

export class WorkerClient {
  private readonly worker: Worker;
  private readonly replyListeners = new Set<ReplyListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly oscErrorListeners = new Set<OscErrorListener>();
  private readonly tickListeners = new Set<TickListener>();
  private readonly bufferChunkListeners = new Map<
    string,
    Set<BufferChunkListener>
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
          // Per-reply log was useful while bringing the WS up but
          // floods DebugLog at runtime (status heartbeats, /b_setn
          // chunks, /tr ticks). Drop it; reply addresses still
          // surface via specific listeners (footer status, scope
          // stream, etc.) when relevant.
          for (const cb of this.replyListeners) cb(msg.reply);
          break;
        case 'oscError':
          // Phase 24: handlers (ServerErrorBus) decide what to do —
          // we don't console.error here, since the bus does that
          // itself with structured context.
          for (const cb of this.oscErrorListeners) cb(msg.error);
          break;
        case 'clockTick':
          for (const cb of this.tickListeners) cb(msg.tick);
          break;
        case 'bufferChunk': {
          const cbs = this.bufferChunkListeners.get(msg.chunk.bufferId);
          if (cbs) {
            for (const cb of cbs) cb(msg.chunk);
          }
          // No listener registered → drop on the floor; the worker
          // already paid the cost of decoding, but holding onto an
          // orphan chunk would just leak the Float32Array.
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

  /** Phase 24 — subscribe to decoded `/fail` replies. The same reply
   *  also reaches `onReply` so existing matchers (e.g.
   *  `SynthDefRegistry`'s `/fail /d_recv`) continue to work; this
   *  channel is the catch-all for unmatched failures. */
  onOscError(cb: OscErrorListener): () => void {
    this.oscErrorListeners.add(cb);
    return () => this.oscErrorListeners.delete(cb) as unknown as void;
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

  /** Register a tick-driven /b_getn loop on the worker for `sub.bufnum`
   *  and route the resulting `bufferChunk` events to `cb`. Multiple
   *  main-side listeners can attach to the same `bufferId` — they
   *  share one worker-side subscription and each receive every
   *  delivered chunk (the `Float32Array` reference is shared and
   *  must be treated as read-only — see `BufferChunk` jsdoc).
   *
   *  Pair every call with the returned `unsubscribe()`. The last
   *  unsubscribe for a given `bufferId` posts `unsubscribeBuffer` to
   *  the worker. */
  subscribeBuffer(
    sub: BufferSubscription,
    cb: BufferChunkListener,
  ): BufferSubscriptionHandle {
    let cbs = this.bufferChunkListeners.get(sub.bufferId);
    const isFirstSubscriber = !cbs || cbs.size === 0;
    if (!cbs) {
      cbs = new Set();
      this.bufferChunkListeners.set(sub.bufferId, cbs);
    }
    cbs.add(cb);
    if (isFirstSubscriber) {
      // Worker only sees one `subscribeBuffer` per `bufferId` —
      // additional main-side listeners just join the local fan-out
      // Set. Sending a duplicate would reset the worker's
      // pendingByOffset / reorderBuffer state and cause a brief
      // delivery stutter for existing listeners.
      this.post({ type: 'subscribeBuffer', subscription: sub });
    }
    let disposed = false;
    return {
      unsubscribe: () => {
        if (disposed) return;
        disposed = true;
        const set = this.bufferChunkListeners.get(sub.bufferId);
        if (!set) return;
        set.delete(cb);
        if (set.size === 0) {
          this.bufferChunkListeners.delete(sub.bufferId);
          this.post({ type: 'unsubscribeBuffer', bufferId: sub.bufferId });
        }
      },
    };
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
    this.oscErrorListeners.clear();
    this.tickListeners.clear();
    this.bufferChunkListeners.clear();
  }

  private post(msg: MainToWorker): void {
    this.worker.postMessage(msg);
  }
}
