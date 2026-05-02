/**
 * Public types for the SuperDirt OSC client.
 *
 * Phase 26 reshape: the DirtClient no longer owns its own WS.
 * SuperDirt traffic flows over the same `/ws` as scsynth, demuxed
 * inside the Rust bridge by the `/dirt` route. With the socket
 * lifecycle gone, `DirtStatus` shrinks to a three-state hello-probe
 * outcome (Q1 = i).
 */

/** A single value in a Dirt event payload. SuperDirt accepts strings
 *  and numbers; everything else gets stringified by osc-js. */
export type DirtArg = string | number;

/** Parse-time errors raised by `parseDirtRepl`. The panel catches
 *  these and surfaces the message inline below the REPL input. */
export class DirtParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DirtParseError';
  }
}

/** User-typed event input. Keys are Dirt parameter names (`s`, `n`,
 *  `amp`, `cutoff`, …). The conventional first key is `s` (sample
 *  name); the order of `Object.entries` is the OSC arg order
 *  scsynth sees. */
export type DirtEventInput = Record<string, DirtArg>;

/** DirtClient lifecycle state — outcome of the hello round-trip.
 *  - `probing`: probe in flight (initial state at dashboard mount).
 *  - `alive`: `/dirt/hello/reply` received within timeout.
 *  - `unreachable`: probe timed out — usually because the bridge has
 *    no `/dirt` route configured, or SuperDirt isn't running.
 *
 *  Sends (`play`, `setControlBus`) are never gated on this status —
 *  the bridge forwards regardless. The status is purely a UI hint. */
export type DirtStatus = 'probing' | 'alive' | 'unreachable';

/** Decoded OSC reply forwarded to `onReply` listeners and the panel.
 *  `args` is exactly what osc-js produced. */
export interface DirtReply {
  address: string;
  args: ReadonlyArray<unknown>;
}

/** Phase 27 — entry in the live sample-bank list returned by
 *  `/dirt/listSamples`. `count` is the number of variants in the
 *  bank (the `n` parameter on /dirt/play picks among them). */
export interface SampleBank {
  name: string;
  count: number;
}

/** One entry in the bounded `recentEvents` ring.
 *
 *  - `direction: 'out'` — outgoing `/dirt/play`. `label` is the
 *    Tidal-ish shorthand (e.g. `bd cutoff:800`).
 *  - `direction: 'in'` — incoming reply. `label` is the OSC address. */
export interface DirtEventLog {
  direction: 'out' | 'in';
  label: string;
  address: string;
  args: ReadonlyArray<unknown>;
  /** Wall clock (ms since epoch) at log time. */
  receivedAt: number;
}
