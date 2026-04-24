/**
 * Server-wide / argless commands plus a few multi-purpose messages
 * (sync, notify, dumpOSC, error, /cmd, /u_cmd).
 */

import OSC from 'osc-js';
import type { OscArg } from '../types';

// osc-js's .d.ts types blob args as `Blob`; runtime accepts Uint8Array.
// Widen via cast here so our `OscArg` (which includes Uint8Array) is
// accepted at construction.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyArr = (xs: ReadonlyArray<OscArg>): any[] => xs as any[];

// ── Argless ───────────────────────────────────────────────────────────

export const clearSched = (): OSC.Message => new OSC.Message('/clearSched');
export const nrtEnd = (): OSC.Message => new OSC.Message('/nrt_end');
export const quit = (): OSC.Message => new OSC.Message('/quit');
export const rtMemoryStatus = (): OSC.Message => new OSC.Message('/rt_memoryStatus');
export const status = (): OSC.Message => new OSC.Message('/status');
export const version = (): OSC.Message => new OSC.Message('/version');

// ── /sync ─────────────────────────────────────────────────────────────

/** `/sync id`. Prefer `WorkerClient.sendAndSync` which allocates the id
 *  for you — this helper is useful for embedding into `completionMsg`s. */
export const sync = (id: number): OSC.Message => new OSC.Message('/sync', id);

// ── /notify ───────────────────────────────────────────────────────────

/** `/notify enable` (+ optional clientId for multi-client setups). */
export const notify = (enable: 0 | 1, clientId?: number): OSC.Message =>
  clientId === undefined
    ? new OSC.Message('/notify', enable)
    : new OSC.Message('/notify', enable, clientId);

// ── /dumpOSC ──────────────────────────────────────────────────────────

/** Mode: 0=off, 1=parsed, 2=hex, 3=both. */
export const dumpOsc = (mode: 0 | 1 | 2 | 3): OSC.Message =>
  new OSC.Message('/dumpOSC', mode);

// ── /error ────────────────────────────────────────────────────────────

/** Server error-posting mode: 0=off, 1=on (default), 2=off-scope/on-bundle,
 *  -1/-2 = same for one command, then back. */
export const errorMode = (mode: number): OSC.Message => new OSC.Message('/error', mode);

// ── /cmd and /u_cmd (plugin / UGen extension dispatch) ────────────────

export const cmd = (name: string, ...args: OscArg[]): OSC.Message =>
  new OSC.Message('/cmd', name, ...anyArr(args));

export const uCmd = (
  nodeId: number,
  ugenIndex: number,
  commandName: string,
  ...args: OscArg[]
): OSC.Message =>
  new OSC.Message('/u_cmd', nodeId, ugenIndex, commandName, ...anyArr(args));

// ── Raw escape hatch ─────────────────────────────────────────────────

/** Drop down to a raw address + positional args — for commands this
 *  package doesn't model specifically, or for experimenting. */
export const raw = (address: string, ...args: OscArg[]): OSC.Message =>
  new OSC.Message(address, ...anyArr(args));
