/**
 * Side-effect module: hook the worker's console so every log line is
 * forwarded to the main thread as a `{ type: 'log' }` message. Must be
 * imported FIRST in the worker entry so it installs before any other
 * module's top-level code (e.g. jco's wasm instantiation) runs.
 *
 * ESM evaluates imports in source order; placing this import above the
 * wasm bindings guarantees the forwarder is live by the time `await
 * $init` happens.
 */

import type { WorkerToMain } from '../server/workerProtocol';

type Level = 'log' | 'info' | 'warn' | 'error';

const orig = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function render(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.stack ?? a.message;
      try {
        return JSON.stringify(a, (_, v) =>
          typeof v === 'bigint' ? String(v) + 'n' : v,
        );
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

function forward(level: Level) {
  return (...args: unknown[]) => {
    orig[level](...args);
    try {
      const msg: WorkerToMain = { type: 'log', level, message: render(args) };
      (self as unknown as {
        postMessage: (m: WorkerToMain) => void;
      }).postMessage(msg);
    } catch {
      // Drop silently if the payload can't be cloned.
    }
  };
}

console.log = forward('log');
console.info = forward('info');
console.warn = forward('warn');
console.error = forward('error');

orig.log('[sc:worker] console bridge installed');
