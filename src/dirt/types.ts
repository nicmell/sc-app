/**
 * Public types for the SuperDirt OSC client.
 *
 * The shape mirrors `WorkerClient`'s reply types but lives entirely
 * on the main thread — DirtClient runs without a worker. See the
 * controller jsdoc for the architectural rationale.
 */

/** A single value in a Dirt event payload. SuperDirt accepts strings
 *  and numbers; everything else gets stringified by osc-js. */
export type DirtArg = string | number;

/** User-typed event input. Keys are Dirt parameter names (`s`, `n`,
 *  `amp`, `cutoff`, …). The conventional first key is `s` (sample
 *  name); the order of `Object.entries` is the OSC arg order
 *  scsynth sees. */
export type DirtEventInput = Record<string, DirtArg>;

/** DirtClient lifecycle state.
 *  - `disconnected`: idle, no WS open.
 *  - `connecting`: WS opening or `/dirt/hello` round-trip in flight.
 *  - `alive`: WS open, hello reply received.
 *  - `unreachable`: WS closed or hello timed out — terminal until
 *    the next `connect()` call. */
export type DirtStatus = 'disconnected' | 'connecting' | 'alive' | 'unreachable';

/** Decoded OSC reply forwarded to `onReply` listeners and the panel
 *  (after Phase 25c). `args` is exactly what osc-js produced. */
export interface DirtReply {
  address: string;
  args: ReadonlyArray<unknown>;
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
