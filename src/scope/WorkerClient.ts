/**
 * Main-thread wrapper around the scope worker. Owns the Worker
 * instance and exposes a tight, typed API.
 *
 * Phase 1: bytes-in / bytes-out. Later phases will add typed command
 * / reply methods on top of the same transport.
 */

import type { MainToWorker, WorkerToMain } from './workerProtocol';

const READY_TIMEOUT_MS = 3000;

export type RecvListener = (bytes: Uint8Array) => void;
export type ErrorListener = (err: string) => void;

export class WorkerClient {
  private readonly worker: Worker;
  private readonly recvListeners = new Set<RecvListener>();
  private readonly errorListeners = new Set<ErrorListener>();
  readonly ready: Promise<void>;

  /** `url` is the full WS URL including the `?scsynth=HOST:PORT` param. */
  constructor(url: string) {
    this.worker = new Worker(
      new URL('../workers/scopeWorker.ts', import.meta.url),
      { type: 'module' },
    );

    this.ready = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error(`worker/WS did not become ready within ${READY_TIMEOUT_MS} ms`));
      }, READY_TIMEOUT_MS);

      const handleReady = (ev: MessageEvent<WorkerToMain>) => {
        if (ev.data.type === 'ready') {
          cleanup();
          resolve();
        } else if (ev.data.type === 'error') {
          cleanup();
          reject(new Error(ev.data.message));
        }
      };

      const cleanup = () => {
        window.clearTimeout(timeout);
        this.worker.removeEventListener('message', handleReady);
      };

      this.worker.addEventListener('message', handleReady);
    });

    // Long-lived dispatcher for non-handshake messages.
    this.worker.addEventListener('message', (ev: MessageEvent<WorkerToMain>) => {
      const msg = ev.data;
      switch (msg.type) {
        case 'recv':
          for (const cb of this.recvListeners) cb(msg.bytes);
          break;
        case 'error':
          for (const cb of this.errorListeners) cb(msg.message);
          break;
      }
    });

    this.post({ type: 'connect', url });
  }

  send(bytes: Uint8Array): void {
    // Copy into a fresh buffer so we can transfer it without
    // surprising the caller by detaching their Uint8Array.
    const copy = new Uint8Array(bytes);
    this.worker.postMessage({ type: 'send', bytes: copy } satisfies MainToWorker, [
      copy.buffer,
    ]);
  }

  onRecv(cb: RecvListener): () => void {
    this.recvListeners.add(cb);
    return () => this.recvListeners.delete(cb) as unknown as void;
  }

  onError(cb: ErrorListener): () => void {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb) as unknown as void;
  }

  dispose(): void {
    this.post({ type: 'disconnect' });
    this.worker.terminate();
    this.recvListeners.clear();
    this.errorListeners.clear();
  }

  private post(msg: MainToWorker): void {
    this.worker.postMessage(msg);
  }
}
