/**
 * Mirror everything written to console (via standard `[sc:*]` prefixes)
 * into an in-memory ring buffer that the UI can display. Useful when
 * the user can't open DevTools — e.g. the Tauri webview on macOS
 * without `devtools` feature flag, or a browser with the console
 * hidden.
 *
 * We don't replace console entirely; we monkey-patch the four levels
 * (log/info/warn/error) to push into the buffer as a *side effect* of
 * the normal call. Original console behaviour is preserved verbatim.
 */

import { createStore, type ReadonlyStore } from './reactiveStore';

export type DebugLevel = 'log' | 'info' | 'warn' | 'error';

export interface DebugEntry {
  id: number;
  timestamp: number;
  level: DebugLevel;
  text: string;
}

const MAX_ENTRIES = 500;

const store = createStore<DebugEntry[]>([]);
let nextId = 0;

function render(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a instanceof Error) return a.stack ?? a.message;
      try {
        return JSON.stringify(a, (_, v) => (typeof v === 'bigint' ? String(v) + 'n' : v));
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

/** Phase 23 — optional sink for shipping log entries to the bridge.
 *  `installLogShipper()` from `@/util/logShipper` registers itself
 *  here; we call the shipper as a side-effect of every push so the
 *  ring + the shipper see exactly the same entries. */
type ShipperFn = (entry: DebugEntry, immediate: boolean) => void;
let shipper: ShipperFn | null = null;
export function setLogShipper(fn: ShipperFn | null): void {
  shipper = fn;
}

function push(level: DebugLevel, args: unknown[]): void {
  const text = render(args);
  const entry: DebugEntry = {
    id: ++nextId,
    timestamp: performance.now(),
    level,
    text,
  };
  const prev = store.get();
  const next =
    prev.length >= MAX_ENTRIES ? [...prev.slice(-(MAX_ENTRIES - 1)), entry] : [...prev, entry];
  store.set(next);

  // Forward to the log shipper if installed. ERROR + WARN flush
  // immediately; LOG + INFO are batched. The shipper itself is
  // resilient to its own POST failures (drops on error) so a bad
  // network won't recurse through here.
  shipper?.(entry, level === 'error' || level === 'warn');
}

let installed = false;
export function installDebugLog(): void {
  if (installed) return;
  installed = true;
  const orig = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };
  console.log = (...args) => {
    orig.log(...args);
    push('log', args);
  };
  console.info = (...args) => {
    orig.info(...args);
    push('info', args);
  };
  console.warn = (...args) => {
    orig.warn(...args);
    push('warn', args);
  };
  console.error = (...args) => {
    orig.error(...args);
    push('error', args);
  };
  console.log('[sc:debugLog] installed');
}

export const debugLog: ReadonlyStore<DebugEntry[]> = store;

export function clearDebugLog(): void {
  store.set([]);
}
