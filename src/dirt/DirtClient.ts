/**
 * Main-thread client for SuperDirt OSC commands, layered on top of
 * the existing [`WorkerClient`].
 *
 * Phase 26 reshape: there's no second WebSocket. `/dirt/*` packets
 * fly over the same `/ws` as scsynth control traffic; the Rust
 * bridge demuxes by OSC-address prefix (route `/dirt → :57120`) and
 * SuperDirt's replies fan back through the same WS. The DirtClient
 * just encodes commands, hands them to `WorkerClient.sendCommand`,
 * and listens for `/dirt/*` replies via `WorkerClient.onReply`.
 *
 * Status surface (three-state, Q1 = i):
 * - `'probing'` (initial) — set on construction; flipped by
 *   [`DirtClient.probe`] which fires once at dashboard mount.
 * - `'alive'` — `/dirt/hello/reply` received within the timeout.
 * - `'unreachable'` — probe timed out. Usually means the bridge
 *   route is missing or SuperDirt isn't running.
 *
 * Sends (`play`, `setControlBus`, `hello`) are never gated on
 * status. The bridge forwards regardless; the status is a UI hint
 * for the user. A play() while `'unreachable'` simply gets dropped
 * silently by the OS-level UDP layer when it lands at the bridge's
 * route socket and there's no peer.
 */

import OSC from 'osc-js';
import { inFuture, type OscPacket, type Timetag } from '@sc-app/server-commands';

import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import type { WorkerClient } from '@/server/WorkerClient';

import {
  DIRT_HELLO_REPLY,
  dirtHello,
  dirtPlay,
  dirtSetControlBus,
} from './dirtCommands';
import type {
  DirtEventInput,
  DirtEventLog,
  DirtReply,
  DirtStatus,
  SampleBank,
} from './types';

const HELLO_TIMEOUT_MS = 1000;
const DEFAULT_LOOKAHEAD_MS = 100;
const RECENT_EVENT_RING_SIZE = 20;

export type DirtReplyListener = (reply: DirtReply) => void;

interface PendingHello {
  resolve: () => void;
  reject: (e: Error) => void;
  // window.setTimeout returns number in the DOM lib; @types/node
  // shadows it with a NodeJS.Timeout, so be explicit.
  timer: number;
}

export class DirtClient {
  private readonly _status = createStore<DirtStatus>('probing');
  private readonly _recentEvents = createStore<ReadonlyArray<DirtEventLog>>([]);
  private readonly _sampleBanks = createStore<ReadonlyArray<SampleBank>>([]);
  private readonly replyListeners = new Set<DirtReplyListener>();
  private readonly client: WorkerClient;
  private offReply: (() => void) | null = null;
  private helloPending: PendingHello | null = null;
  private disposed = false;

  constructor(client: WorkerClient) {
    this.client = client;
    // Subscribe to /dirt/* replies on the shared WS. Filter at
    // listen-time so non-dirt replies (the bulk of WS traffic) skip
    // the dispatch path entirely.
    this.offReply = this.client.onReply((reply) => {
      if (!reply.address.startsWith('/dirt/')) return;
      this.dispatchReply({ address: reply.address, args: reply.args });
    });
  }

  readonly status: ReadonlyStore<DirtStatus> = this._status;
  readonly recentEvents: ReadonlyStore<ReadonlyArray<DirtEventLog>> =
    this._recentEvents;
  /** Phase 27 — live list of SuperDirt's loaded sample banks,
   *  populated by `listSamples()`. Empty until the first call
   *  resolves. The SequencerPanel's TrackRow autocomplete reads
   *  this; the DirtPanel REPL could too. */
  readonly sampleBanks: ReadonlyStore<ReadonlyArray<SampleBank>> =
    this._sampleBanks;

  /** Hello round-trip. Status flips to `'alive'` on reply,
   *  `'unreachable'` on timeout. Called once by AppShell after
   *  `setupDashboard` mounts the client (Q2 = i). Returns
   *  `true`/`false` for the caller's convenience; the status store
   *  is the canonical UI signal. */
  async probe(timeoutMs: number = HELLO_TIMEOUT_MS): Promise<boolean> {
    if (this.disposed) return false;
    this._status.set('probing');
    try {
      await this.helloRoundTrip(timeoutMs);
      if (!this.disposed) this._status.set('alive');
      return true;
    } catch {
      if (!this.disposed) this._status.set('unreachable');
      return false;
    }
  }

  /** Encode `/dirt/play` inside an OSC bundle stamped
   *  `Date.now() + lookaheadMs` and ship via the shared WS. The
   *  bridge routes it to SuperDirt by prefix; if no `/dirt` route
   *  is configured (or SuperDirt isn't running), the send goes
   *  silently to nowhere. */
  play(event: DirtEventInput, opts: { lookaheadMs?: number } = {}): void {
    if (this.disposed) return;
    const lookaheadMs = opts.lookaheadMs ?? DEFAULT_LOOKAHEAD_MS;
    const msg = dirtPlay(event);
    const bundle = new OSC.Bundle([msg], inFuture(lookaheadMs));
    this.sendPacket(bundle);
    this.logEvent({
      direction: 'out',
      label: formatPlayLabel(event),
      address: msg.address,
      args: msg.args.slice(),
      receivedAt: Date.now(),
    });
  }

  /** Phase 27 — sample-accurate variant of `play`. Caller passes
   *  a precomputed timetag (typically from
   *  `tickToTimetag(clock.tick0Ms, targetTick, tickRate)`) so the
   *  OSC bundle fires at a specific audio frame on SuperDirt's
   *  side. Used by the SequencerController; the REPL still uses
   *  the convenience `play(...)` form above. */
  playAtTimetag(event: DirtEventInput, timetag: Timetag): void {
    if (this.disposed) return;
    const msg = dirtPlay(event);
    const bundle = new OSC.Bundle([msg], timetag);
    this.sendPacket(bundle);
    this.logEvent({
      direction: 'out',
      label: formatPlayLabel(event),
      address: msg.address,
      args: msg.args.slice(),
      receivedAt: Date.now(),
    });
  }

  /** Phase 39b: seed the sample-bank store from the cached
   *  bootstrap snapshot (SessionInfo.dirtSamples). Replaces the
   *  pre-39 `/dirt/listSamples` OSC round-trip; the bridge
   *  fetches once at boot, frontend reads from there. */
  setSampleBanks(banks: ReadonlyArray<SampleBank>): void {
    if (this.disposed) return;
    this._sampleBanks.set(banks);
  }

  /** Round-trip `/dirt/hello`; resolve `true` on reply, `false` on
   *  timeout. Used by `probe`; also exposed for on-demand health
   *  checks (Q2 future-extension hook). Only one hello can be in
   *  flight at a time — concurrent calls are rejected. */
  async hello(timeoutMs: number = HELLO_TIMEOUT_MS): Promise<boolean> {
    if (this.disposed) return false;
    try {
      await this.helloRoundTrip(timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  setControlBus(idx: number, value: number): void {
    if (this.disposed) return;
    this.sendPacket(dirtSetControlBus(idx, value));
  }

  onReply(cb: DirtReplyListener): () => void {
    this.replyListeners.add(cb);
    return () => {
      this.replyListeners.delete(cb);
    };
  }

  /** Tear down listener subscription. Called by AppShell on
   *  `handleDisconnect` and the chunkSize re-init flow.
   *  Idempotent. The underlying WS belongs to `WorkerClient` and
   *  isn't touched. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.offReply?.();
    this.offReply = null;
    if (this.helloPending) {
      const pending = this.helloPending;
      this.helloPending = null;
      window.clearTimeout(pending.timer);
      pending.reject(new Error('DirtClient disposed'));
    }
    this.replyListeners.clear();
  }

  // ── private ────────────────────────────────────────────────────────

  private sendPacket(packet: OscPacket): void {
    this.client.sendCommand(packet);
  }

  private helloRoundTrip(timeoutMs: number): Promise<void> {
    if (this.helloPending) {
      return Promise.reject(
        new Error('/dirt/hello already in flight — concurrent calls rejected'),
      );
    }
    return new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.helloPending = null;
        reject(new Error(`/dirt/hello timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.helloPending = { resolve, reject, timer };
      this.sendPacket(dirtHello());
    });
  }

  private dispatchReply(reply: DirtReply): void {
    this.logEvent({
      direction: 'in',
      label: reply.address,
      address: reply.address,
      args: reply.args,
      receivedAt: Date.now(),
    });

    if (reply.address === DIRT_HELLO_REPLY && this.helloPending) {
      const pending = this.helloPending;
      this.helloPending = null;
      window.clearTimeout(pending.timer);
      pending.resolve();
    }

    for (const cb of this.replyListeners) cb(reply);
  }

  private logEvent(entry: DirtEventLog): void {
    const next = [entry, ...this._recentEvents.get()].slice(
      0,
      RECENT_EVENT_RING_SIZE,
    );
    this._recentEvents.set(next);
  }
}

/** Render a Tidal-ish shorthand from an event input — used as the
 *  display label in the recent-events log. */
function formatPlayLabel(event: DirtEventInput): string {
  const entries = Object.entries(event);
  if (entries.length === 0) return '(empty)';
  // Conventional ordering: `s` first (the sample name), then mods.
  const sIdx = entries.findIndex(([k]) => k === 's');
  if (sIdx >= 0) {
    const [, sVal] = entries[sIdx];
    const rest = entries.filter((_, i) => i !== sIdx);
    const tail = rest.map(([k, v]) => `${k}:${v}`).join(' ');
    return tail ? `${sVal} ${tail}` : String(sVal);
  }
  return entries.map(([k, v]) => `${k}:${v}`).join(' ');
}
