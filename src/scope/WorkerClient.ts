/**
 * Main-thread wrapper around the scope worker.
 *
 * Phase 2 surface:
 * - `sendCommand(cmd)`          — fire-and-forget typed command
 * - `onReply(cb)`               — subscribe to typed replies
 * - `onError(cb)`               — subscribe to worker/WS errors
 * - `sendAndAwaitReply(cmd, match, timeoutMs)` — one-shot: send a
 *   command and resolve when a matching reply arrives. Used for
 *   correlation-free probes like Status.
 * - `sendAndSync(cmd, timeoutMs)` — send a command then a `/sync`,
 *   resolve when the matching `/synced` comes back. Used when the
 *   command has no reply of its own (`/d_recv`, buffer ops, etc.).
 */

import type {
  MainToWorker,
  ServerMessage,
  ServerReply,
  WorkerToMain,
} from './workerProtocol';

const READY_TIMEOUT_MS = 3000;
const DEFAULT_SYNC_TIMEOUT_MS = 2000;

export type ReplyListener = (reply: ServerReply) => void;
export type ErrorListener = (message: string) => void;
export type ReplyMatcher = (reply: ServerReply) => boolean;

export class WorkerClient {
  private readonly worker: Worker;
  private readonly replyListeners = new Set<ReplyListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  private nextSyncId = 1;
  readonly ready: Promise<void>;

  /** `url` is the full WS URL including the `?scsynth=HOST:PORT` param. */
  constructor(url: string) {
    console.log('[sc:client] constructing WorkerClient', url);
    this.worker = new Worker(
      new URL('../workers/scopeWorker.ts', import.meta.url),
      { type: 'module' },
    );

    // Module-level errors inside the worker (e.g. a failed top-level
    // wasm init) would otherwise just kill the worker silently and
    // leave the ready handshake to time out. Surface them loudly.
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
          console.log('[sc:client] reply', msg.reply.tag);
          for (const cb of this.replyListeners) cb(msg.reply);
          break;
        case 'error':
          console.warn('[sc:client] error', msg.message);
          for (const cb of this.errorListeners) cb(msg.message);
          break;
        case 'log': {
          // Forward worker-side console calls to the main-thread
          // console — the monkey-patched version (see `debugLog.ts`)
          // captures them into the on-screen log panel.
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

  sendCommand(command: ServerMessage): void {
    this.post({ type: 'command', command });
  }

  onReply(cb: ReplyListener): () => void {
    this.replyListeners.add(cb);
    return () => this.replyListeners.delete(cb) as unknown as void;
  }

  onError(cb: ErrorListener): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb) as unknown as void;
  }

  /**
   * Send `cmd` and resolve on the first reply satisfying `match`.
   * Use for correlation-free probes (e.g. Status → StatusReply).
   */
  sendAndAwaitReply(
    cmd: ServerMessage,
    match: ReplyMatcher,
    timeoutMs = DEFAULT_SYNC_TIMEOUT_MS,
  ): Promise<ServerReply> {
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
      this.sendCommand(cmd);
    });
  }

  /**
   * Send `cmd`, then a `/sync` with a fresh id; resolve when the
   * matching `/synced` reply arrives. Use for commands with no reply
   * of their own (e.g. `/d_recv`, `/b_alloc`).
   */
  sendAndSync(cmd: ServerMessage, timeoutMs = DEFAULT_SYNC_TIMEOUT_MS): Promise<void> {
    const syncId = this.nextSyncId++;
    return new Promise((resolve, reject) => {
      const offReply = this.onReply((reply) => {
        if (reply.tag !== 'synced' || reply.val.syncId !== syncId) return;
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
      this.sendCommand(cmd);
      this.sendCommand({ tag: 'sync', val: { aUniqueNumber: syncId } });
    });
  }

  /**
   * Send a command that itself embeds a `/sync` (e.g. `/d_recv`'s
   * `completionMsg` field), then resolve when the matching `/synced`
   * reply arrives. The caller receives the fresh sync id via the
   * `buildCmd` callback and is responsible for embedding it in the
   * right place on the outgoing command.
   *
   * This is the atomic variant of `sendAndSync` — useful when the
   * server should run the sync *after* an async operation completes
   * (the synthdef is installed, the buffer is allocated, …) rather
   * than racing it against a separate `/sync`.
   */
  sendCommandAndAwaitSync(
    buildCmd: (syncId: number) => ServerMessage,
    timeoutMs = DEFAULT_SYNC_TIMEOUT_MS,
  ): Promise<void> {
    const syncId = this.nextSyncId++;
    return new Promise((resolve, reject) => {
      const offReply = this.onReply((reply) => {
        if (reply.tag !== 'synced' || reply.val.syncId !== syncId) return;
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
      this.sendCommand(buildCmd(syncId));
    });
  }

  dispose(): void {
    this.post({ type: 'disconnect' });
    this.worker.terminate();
    this.replyListeners.clear();
    this.errorListeners.clear();
  }

  private post(msg: MainToWorker): void {
    this.worker.postMessage(msg);
  }
}
