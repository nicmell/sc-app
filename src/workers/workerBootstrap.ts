/**
 * Worker bootstrap — imported FIRST in the worker entry. Two jobs,
 * both executed synchronously during this module's evaluation so
 * nothing else runs ahead of them:
 *
 * 1. **Message buffer.** When the main thread posts messages right
 *    after `new Worker(...)`, the worker's module graph may still be
 *    loading (module workers resolve imports async). Listeners
 *    registered later would miss those early events entirely, since
 *    `addEventListener('message')` doesn't backfill. We install a
 *    buffering listener here, then drain it once the real handler
 *    is wired up by `setWorkerMessageHandler`.
 *
 * 2. **`window` shim.** osc-js uses `typeof global !== 'undefined' ?
 *    global : window` to locate runtime globals. In a Worker neither
 *    `global` nor `window` is defined, so the lookup throws. Aliasing
 *    `globalThis.window = globalThis` here — before any osc-js
 *    import — lets that expression resolve cleanly. Workers expose
 *    `TextDecoder` on the global scope already, which is all osc-js
 *    actually needs from `window`.
 *
 * This module intentionally has no imports, so ESM evaluation order
 * guarantees it runs before everything else in the worker.
 */

import type { MainToWorker } from '../server/workerProtocol';

if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
  (globalThis as { window?: unknown }).window = globalThis;
}

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
 * arrived while the worker was still loading. Call exactly once
 * from the main worker module after initialisation.
 */
export function setWorkerMessageHandler(handler: Handler): void {
  realHandler = handler;
  if (buffer.length > 0) {
    console.log(`[sc:worker] draining ${buffer.length} buffered message(s)`);
  }
  const drained = buffer.splice(0);
  for (const msg of drained) handler(msg);
}
