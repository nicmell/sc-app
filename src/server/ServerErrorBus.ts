/**
 * Phase 24 — centralized bus for scsynth `/fail` replies.
 *
 * Subscribes to `WorkerClient.onOscError` once at construction;
 * pushes every received `/fail` into a bounded ring (default 100
 * entries) exposed as a `ReadonlyStore` for UI consumers (DebugLog
 * Errors section, header counter).
 *
 * Side effects per event:
 *   1. Push to the ring (newest first).
 *   2. `console.error` with a compact summary so the entry shows up
 *      in DebugLog's existing buffer alongside other errors. The
 *      structured fields are still available via the store; the
 *      console line is a convenience.
 *
 * Disposal:
 *   `dispose()` unsubscribes from the WorkerClient and clears the
 *   store. The bus is owned by `AppShell.DashboardResources` and
 *   lives one-per-session — created in `setupDashboard`, disposed
 *   in `teardownServerState`. chunkSize re-init creates a fresh
 *   bus (cheap; no server-side state to manage).
 *
 * Ring semantics:
 *   - Newest entry at index 0.
 *   - Capped at `RING_SIZE` (default 100). Older entries drop
 *     silently — UI uses `total` to surface "12× /fail /s_new …"
 *     style summaries if/when consecutive-duplicate counting is
 *     added (deferred per plan).
 *   - Cleared on `dispose` and on explicit `clear()`.
 */

import type { OscError } from './workerProtocol';
import type { WorkerClient } from './WorkerClient';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';

const RING_SIZE = 100;

export interface ServerErrorEntry {
  /** Monotonic id for stable React keys. */
  id: number;
  /** Wall-clock ms since epoch when this entry was added (the worker's
   *  `performance.now()` is not directly comparable to `Date.now()`,
   *  so the bus stamps with `Date.now()` at receive time on the main
   *  thread). */
  receivedAt: number;
  error: OscError;
}

export class ServerErrorBus {
  private readonly _entries = createStore<ServerErrorEntry[]>([]);
  /** Total count seen this session, including dropped (older-than-
   *  ring) entries. The store length capped at RING_SIZE; this
   *  number is unbounded. */
  private readonly _total = createStore<number>(0);
  private nextId = 0;
  private readonly off: () => void;

  constructor(client: WorkerClient) {
    this.off = client.onOscError((error) => this.push(error));
  }

  readonly entries: ReadonlyStore<ReadonlyArray<ServerErrorEntry>> = this._entries;
  readonly total: ReadonlyStore<number> = this._total;

  /** Drop everything from the ring. Doesn't unsubscribe — call
   *  `dispose()` for that. Used by the UI's "clear" button (if/when
   *  one is added) and by `dispose`. */
  clear(): void {
    this._entries.set([]);
    this._total.set(0);
  }

  dispose(): void {
    this.off();
    this.clear();
  }

  private push(error: OscError): void {
    const entry: ServerErrorEntry = {
      id: ++this.nextId,
      receivedAt: Date.now(),
      error,
    };
    const next = [entry, ...this._entries.get()].slice(0, RING_SIZE);
    this._entries.set(next);
    this._total.update((n) => n + 1);

    // Mirror to console so the entry also appears in the existing
    // DebugLog buffer (which monkey-patches console). Keep the line
    // compact — the panel will render the structured fields.
    const extras =
      error.extras.length > 0 ? ` ${JSON.stringify(error.extras)}` : '';
    console.error(
      `[sc:bus] /fail ${error.commandAddress}: ${error.errorString}${extras}`,
    );
  }
}
