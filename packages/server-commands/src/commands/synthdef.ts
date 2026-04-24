/**
 * SynthDef commands. `/d_recv` is the one we lean on most — embed a
 * `/sync` bundle in `completionMsg` to atomically correlate install
 * success.
 */

import OSC from 'osc-js';

// osc-js's .d.ts types blob args as `Blob` but its runtime check is
// `instanceof Uint8Array`. Cast at call sites.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const b = (bytes: Uint8Array): any => bytes;

// ── /d_recv ───────────────────────────────────────────────────────────

/** Bytes of one or more compiled synthdefs. `completionMsg` is an
 *  OSC packet (already packed to bytes) scsynth will execute *after*
 *  the synthdefs are installed — a convenient place to embed a
 *  `/sync` so the caller can await the install as a single promise. */
export const dRecv = (
  bytes: Uint8Array,
  completionMsg?: Uint8Array,
): OSC.Message =>
  completionMsg === undefined
    ? new OSC.Message('/d_recv', b(bytes))
    : new OSC.Message('/d_recv', b(bytes), b(completionMsg));

// ── /d_load, /d_loadDir ───────────────────────────────────────────────

export const dLoad = (
  path: string,
  completionMsg?: Uint8Array,
): OSC.Message =>
  completionMsg === undefined
    ? new OSC.Message('/d_load', path)
    : new OSC.Message('/d_load', path, b(completionMsg));

export const dLoadDir = (
  path: string,
  completionMsg?: Uint8Array,
): OSC.Message =>
  completionMsg === undefined
    ? new OSC.Message('/d_loadDir', path)
    : new OSC.Message('/d_loadDir', path, b(completionMsg));

// ── /d_free ───────────────────────────────────────────────────────────

export const dFree = (...defNames: string[]): OSC.Message =>
  new OSC.Message('/d_free', ...defNames);
