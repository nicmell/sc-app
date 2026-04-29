/**
 * Phase 23 — frontend log shipper.
 *
 * Hooks into `debugLog`'s push channel via `setLogShipper`, batches
 * entries for ~5 seconds (or up to 100 per batch), and POSTs them
 * as NDJSON to `/api/logs`. ERROR and WARN entries flush
 * immediately; LOG / INFO are batched.
 *
 * Recursion guard: this module *never* logs via `console.*`. If the
 * fetch fails we silently drop and tally; after 3 consecutive
 * failures the shipper goes "dead" and stops queueing entirely
 * (avoids unbounded growth on a server that's gone away). The user
 * still sees everything in the in-memory `debugLog` ring; the
 * Download button gets it locally regardless.
 *
 * Tauri vs serve: same path. The bridge listens on the same port
 * in both modes (Tauri's `tauri::async_runtime::spawn` runs
 * `server::serve()` against `SC_PORT`, default 3000). The
 * `VITE_OSC_WS_URL` env var (set in `.env.development`) routes the
 * dev frontend's HTTP requests at the bridge port; in production
 * builds we fall back to `window.location.origin`.
 */

import { setLogShipper, type DebugEntry } from './debugLog';

const SHIP_PATH = '/api/logs';
const BATCH_INTERVAL_MS = 5_000;
const MAX_BATCH = 100;
const MAX_CONSECUTIVE_FAILURES = 3;

interface ShippableEntry {
  /** ms since epoch — the bridge stores this as `ts_ms`. */
  timestamp: number;
  level: string;
  message: string;
  source: 'frontend';
}

let queue: ShippableEntry[] = [];
let timer: number | null = null;
let consecutiveFailures = 0;
let dead = false;
let installed = false;

function shipUrl(): string {
  const base =
    (import.meta.env.VITE_OSC_WS_URL as string | undefined) ?? window.location.origin;
  return new URL(SHIP_PATH, base).href;
}

async function flush(): Promise<void> {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (dead || queue.length === 0) return;

  const batch = queue;
  queue = [];
  const body = batch.map((e) => JSON.stringify(e)).join('\n') + '\n';

  try {
    const res = await fetch(shipUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-ndjson' },
      body,
      // `keepalive: true` lets the request complete even if the page
      // is unloading — useful for logging WS-close + pagehide events.
      keepalive: true,
    });
    if (res.ok || res.status === 204) {
      consecutiveFailures = 0;
    } else {
      consecutiveFailures += 1;
    }
  } catch {
    // Network error / no-listener / CORS / etc. Drop the batch.
    consecutiveFailures += 1;
  }

  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    dead = true;
  }
}

function enqueue(entry: DebugEntry, immediate: boolean): void {
  if (dead) return;
  queue.push({
    timestamp: Date.now(),
    level: entry.level,
    message: entry.text,
    source: 'frontend',
  });
  if (immediate || queue.length >= MAX_BATCH) {
    void flush();
    return;
  }
  if (timer === null) {
    timer = window.setTimeout(() => {
      void flush();
    }, BATCH_INTERVAL_MS);
  }
}

/** Install the hook. Idempotent — calling more than once is a no-op
 *  after the first install. Should be called once at app start,
 *  alongside `installDebugLog()`. */
export function installLogShipper(): void {
  if (installed) return;
  installed = true;
  setLogShipper((entry, immediate) => enqueue(entry, immediate));
  // Best-effort flush on tab close so the most-recent entries reach
  // the file before the page goes away. `keepalive: true` on the
  // fetch keeps it alive long enough.
  window.addEventListener('pagehide', () => {
    void flush();
  });
}
