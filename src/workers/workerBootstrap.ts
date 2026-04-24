/**
 * Pre-TLA bootstrap — imported FIRST in the worker entry (before the
 * jco wasm bindings, which use a module-level `await $init`).
 *
 * Why: when the main thread posts a `connect` message right after
 * `new Worker(...)`, the worker's wasm bootstrap is still in progress
 * (suspended at the top-level await). The `self.addEventListener(
 * 'message', …)` call only happens after `await $init` resolves, by
 * which time any early `postMessage`s have been delivered to an
 * EventTarget with no listeners — and silently discarded.
 * (Note: this is specific to `addEventListener`; the `self.onmessage`
 * property queues, but we use the event-listener form.)
 *
 * Fix: install a listener synchronously during this module's
 * evaluation. Since ESM evaluates imports in dependency order before
 * top-level code and this module has no imports, it runs first. The
 * listener buffers incoming messages until the real handler is wired
 * up by the main worker module, at which point it drains in order.
 */

import type { MainToWorker } from '../scope/workerProtocol';

type Handler = (msg: MainToWorker) => void;

const buffer: MainToWorker[] = [];
let realHandler: Handler | null = null;

self.addEventListener('message', (ev: MessageEvent<MainToWorker>) => {
  if (realHandler) {
    realHandler(ev.data);
  } else {
    buffer.push(ev.data);
  }
});

/**
 * Install the real message handler and replay any messages that
 * arrived during the pre-TLA window. Call exactly once from the
 * main worker module after initialisation.
 */
export function setWorkerMessageHandler(handler: Handler): void {
  realHandler = handler;
  if (buffer.length > 0) {
    // `postMessage` uses the 'log' channel too — console calls are now
    // mirrored to the main thread, so this console.log surfaces in
    // the on-screen debug log.
    console.log(`[sc:worker] draining ${buffer.length} buffered message(s)`);
  }
  const drained = buffer.splice(0);
  for (const msg of drained) handler(msg);
}
