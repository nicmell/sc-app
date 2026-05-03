/**
 * Vitest setup — runs once per test file before any test.
 *
 * The worker module under test (`src/workers/sequencerWorker.ts`)
 * uses `self.postMessage` (the WorkerGlobalScope alias). In a
 * `node` environment there's no `self`, so we polyfill it to
 * `globalThis`. Individual tests overwrite `globalThis.postMessage`
 * with `vi.fn()` to assert on what the worker would have posted
 * back to the main thread.
 *
 * osc-js has its own `window`-needs (it captures globals at
 * import time). The same shim used by `src/workers/workerBootstrap.ts`
 * applies here.
 */
(globalThis as unknown as { self: typeof globalThis }).self = globalThis;
(globalThis as unknown as { window: typeof globalThis }).window = globalThis;
