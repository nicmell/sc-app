/**
 * Main-thread wrapper around the scope worker.
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
  WorkerToMain,
} from './workerProtocol';

const READY_TIMEOUT_MS = 3000;
const DEFAULT_SYNC_TIMEOUT_MS = 2000;

export type ReplyListener = (reply: OscReply) => void;
export type ErrorListener = (message: string) => void;
export type TickListener = (tick: ClockTick) => void;
export type ReplyMatcher = (reply: OscReply) => boolean;

export class WorkerClient {
  private readonly worker: Worker;
  private readonly replyListeners = new Set<ReplyListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private readonly tickListeners = new Set<TickListener>();
  private nextSyncId = 1;
  readonly ready: Promise<void>;

  /** `url` is the full WS URL including the `?scsynth=HOST:PORT` param. */
  constructor(url: string) {
    console.log('[sc:client] constructing WorkerClient', url);
    this.worker = new Worker(
      new URL('../workers/scopeWorker.ts', import.meta.url),
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
              `(open DevTools → Application → Workers to inspect the scope worker)`,
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
  }

  private post(msg: MainToWorker): void {
    this.worker.postMessage(msg);
  }
}
