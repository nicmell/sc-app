/**
 * Main-thread WebSocket client for SuperDirt.
 *
 * Surface:
 * - `connect(host, port)` — open `/ws/dirt?host=&port=`, run a
 *   `/dirt/hello` round-trip, resolve on the reply.
 * - `disconnect()` — close the WS, settle to `'disconnected'`.
 * - `play(event, opts?)` — encode `/dirt/play` inside an OSC bundle
 *   timestamped `Date.now() + lookaheadMs` and ship.
 * - `hello(timeoutMs?)` — round-trip ping for connectivity checks.
 * - `setControlBus(idx, value)` — `/dirt/setControlBus`.
 * - `onReply(cb)` — every decoded reply from SuperDirt.
 * - `status` / `recentEvents` — reactive stores for UI binding.
 *
 * Why no worker (vs. WorkerClient): the WorkerClient lives in a
 * worker because the `/b_setn` buffer-chunk hot path runs at 48+ Hz
 * and benefits from off-main decode + zero-copy `Float32Array`
 * transfer. SuperDirt traffic is sparse and small (`/dirt/play`
 * bundles are typically ≤ 1 KB; replies are infrequent), so the
 * postMessage round-trip and the second `osc-js` bootstrap are
 * unjustified cost. Main-thread `WebSocket` it is.
 */

import OSC from 'osc-js';
import {
  decode,
  encode,
  inFuture,
  isBundle,
  isMessage,
  type OscPacket,
} from '@sc-app/server-commands';

import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
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
  private readonly _status = createStore<DirtStatus>('disconnected');
  private readonly _recentEvents = createStore<ReadonlyArray<DirtEventLog>>([]);
  private readonly replyListeners = new Set<DirtReplyListener>();
  private ws: WebSocket | null = null;
  private wsBaseUrl: string;
  private helloPending: PendingHello | null = null;

  /** `wsBaseUrl` defaults to the `VITE_OSC_WS_URL` env var (set in
   *  Tauri builds where the bridge runs on a different origin) or
   *  `window.location.origin`. Same resolution as
   *  `wsUrlFor(address)` in AppShell. */
  constructor(wsBaseUrl?: string) {
    this.wsBaseUrl =
      wsBaseUrl ??
      ((import.meta.env.VITE_OSC_WS_URL as string | undefined) ??
        window.location.origin);
  }

  readonly status: ReadonlyStore<DirtStatus> = this._status;
  readonly recentEvents: ReadonlyStore<ReadonlyArray<DirtEventLog>> =
    this._recentEvents;

  /** Open the WS, run `/dirt/hello`, resolve when SuperDirt replies.
   *  Rejects on bad URL (HTTP 400 from the bridge, which closes the
   *  WS without an `open` event), connection refused, or hello
   *  timeout. Status flips to `'unreachable'` on any failure. */
  async connect(
    host: string,
    port: number,
    opts: { timeoutMs?: number } = {},
  ): Promise<void> {
    const cur = this._status.get();
    if (cur === 'connecting' || cur === 'alive') {
      throw new Error(`DirtClient.connect: already ${cur}`);
    }
    const timeoutMs = opts.timeoutMs ?? HELLO_TIMEOUT_MS;
    this._status.set('connecting');

    const url = this.buildUrl(host, port);
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    // Long-lived listeners attached up front so a close/error during
    // any phase (open, hello, alive) goes through the same handler.
    ws.addEventListener('message', (ev) => this.onMessage(ev));
    ws.addEventListener('close', () => this.onWsClose());
    ws.addEventListener('error', () => this.onWsError());

    // Phase 1: wait for WS open. Cancellable by close/error.
    try {
      await this.awaitOpen(ws);
    } catch (e) {
      this._status.set('unreachable');
      this.ws = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
      throw e;
    }

    // Phase 2: round-trip /dirt/hello. Confirms SuperDirt is actually
    // there (the WS being open just means the Rust bridge bound a
    // UDP socket, not that the peer responds).
    try {
      await this.helloRoundTrip(timeoutMs);
    } catch (e) {
      this._status.set('unreachable');
      this.ws = null;
      try {
        ws.close();
      } catch {
        /* already closed */
      }
      throw e;
    }

    this._status.set('alive');
  }

  /** Close the WS and resolve when it's actually closed. Idempotent. */
  async disconnect(): Promise<void> {
    const ws = this.ws;
    if (!ws) {
      this._status.set('disconnected');
      return;
    }
    this.ws = null;
    return new Promise<void>((resolve) => {
      const onClose = () => {
        ws.removeEventListener('close', onClose);
        this._status.set('disconnected');
        resolve();
      };
      ws.addEventListener('close', onClose);
      try {
        ws.close();
      } catch {
        this._status.set('disconnected');
        resolve();
      }
    });
  }

  /** Encode `/dirt/play` inside an OSC bundle stamped
   *  `Date.now() + lookaheadMs`. Fire-and-forget. No-op (with warn)
   *  unless `status === 'alive'`. */
  play(event: DirtEventInput, opts: { lookaheadMs?: number } = {}): void {
    if (!this.isAlive()) {
      console.warn('[sc:dirt] play() ignored — status =', this._status.get());
      return;
    }
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

  /** Round-trip `/dirt/hello`; resolve `true` on reply, `false` on
   *  timeout. Only one hello can be in flight at a time
   *  (SuperDirt's reply has no transaction id, so concurrent
   *  helloes would race). */
  async hello(timeoutMs: number = HELLO_TIMEOUT_MS): Promise<boolean> {
    if (!this.isAlive()) return false;
    try {
      await this.helloRoundTrip(timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  setControlBus(idx: number, value: number): void {
    if (!this.isAlive()) {
      console.warn(
        '[sc:dirt] setControlBus ignored — status =',
        this._status.get(),
      );
      return;
    }
    this.sendPacket(dirtSetControlBus(idx, value));
  }

  onReply(cb: DirtReplyListener): () => void {
    this.replyListeners.add(cb);
    return () => this.replyListeners.delete(cb) as unknown as void;
  }

  // ── private ────────────────────────────────────────────────────────

  private isAlive(): boolean {
    return this._status.get() === 'alive' && this.ws !== null;
  }

  private buildUrl(host: string, port: number): string {
    const url = new URL('/ws/dirt', this.wsBaseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('host', host);
    url.searchParams.set('port', String(port));
    return url.href;
  }

  private sendPacket(packet: OscPacket): void {
    const bytes = encode(packet);
    // Slice into a fresh ArrayBuffer — Uint8Array#buffer may be a
    // shared underlying buffer (e.g. inside a SharedArrayBuffer
    // pool); WebSocket.send takes ownership semantics-wise of the
    // bytes it ships, so handing it the underlying buffer directly
    // is risky.
    const ab = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
    this.ws!.send(ab);
  }

  private awaitOpen(ws: WebSocket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('close', onCloseEarly);
        ws.removeEventListener('error', onErrorEarly);
      };
      const onOpen = () => {
        cleanup();
        resolve();
      };
      const onCloseEarly = () => {
        cleanup();
        reject(new Error('ws closed before open'));
      };
      const onErrorEarly = () => {
        cleanup();
        reject(new Error('ws error during open'));
      };
      ws.addEventListener('open', onOpen);
      ws.addEventListener('close', onCloseEarly);
      ws.addEventListener('error', onErrorEarly);
    });
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
      this.helloPending = {
        resolve: () => {
          window.clearTimeout(timer);
          this.helloPending = null;
          resolve();
        },
        reject: (e: Error) => {
          window.clearTimeout(timer);
          this.helloPending = null;
          reject(e);
        },
        timer,
      };
      this.sendPacket(dirtHello());
    });
  }

  private onMessage(ev: MessageEvent): void {
    if (!(ev.data instanceof ArrayBuffer)) return;
    const bytes = new Uint8Array(ev.data);
    let packet: OscPacket;
    try {
      packet = decode(bytes);
    } catch (err) {
      console.warn('[sc:dirt] decode failed', err);
      return;
    }
    if (isMessage(packet)) {
      this.dispatchReply({
        address: packet.address,
        args: packet.args.slice(),
      });
      return;
    }
    if (isBundle(packet)) {
      // SuperDirt only sends single-message replies in practice, but
      // be defensive — if a bundle ever appears, just log it.
      console.warn(
        '[sc:dirt] bundle reply ignored (unexpected from SuperDirt)',
        packet,
      );
    }
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
      this.helloPending.resolve();
    }

    for (const cb of this.replyListeners) cb(reply);
  }

  private onWsClose(): void {
    if (this._status.get() === 'alive') {
      this._status.set('unreachable');
    }
    // 'connecting' and 'disconnected' are handled by their respective
    // promise tails; no state change here.
    this.ws = null;
    if (this.helloPending) {
      this.helloPending.reject(
        new Error('ws closed before /dirt/hello/reply'),
      );
    }
  }

  private onWsError(): void {
    // The `error` event in the WS API doesn't carry detail (security
    // restriction). The actual disposition shows up in the following
    // `close` event, which `onWsClose` handles.
    if (this._status.get() === 'alive') {
      console.warn('[sc:dirt] ws error event while alive — close to follow');
    }
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
