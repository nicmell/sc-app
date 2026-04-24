/**
 * Node and synth commands.
 *
 * `/s_new` takes an unlimited tail of `(controlKey, controlValue)`
 * pairs. `controlKey` is a name (string) or control index (int).
 * `controlValue` is a number (int/float) or a bus map string like
 * `"c10"` / `"a2"` — osc-js's type inference tags them correctly.
 */

import OSC from 'osc-js';
import type { ControlKey, ControlValue } from '../types';

// ── Add-action constants (shared with /g_new, /n_order) ───────────────

export const AddToHead = 0;
export const AddToTail = 1;
export const AddBefore = 2;
export const AddAfter = 3;
export const AddReplace = 4;

// ── /s_new ────────────────────────────────────────────────────────────

export interface SNewControls {
  /** `{ freq: 440, bus: 'c10' }` — string keys, numeric or bus-ref values. */
  [name: string]: ControlValue;
}

export function sNew(
  defName: string,
  nodeId: number,
  addAction: number,
  targetId: number,
  controls: SNewControls = {},
): OSC.Message {
  const args: (string | number)[] = [defName, nodeId, addAction, targetId];
  for (const [k, v] of Object.entries(controls)) {
    args.push(k, v);
  }
  return new OSC.Message('/s_new', ...args);
}

/** Lower-level form accepting explicit `(key, value)` pairs — lets
 *  callers use integer control indices or repeat the same key. */
export function sNewPairs(
  defName: string,
  nodeId: number,
  addAction: number,
  targetId: number,
  pairs: ReadonlyArray<[ControlKey, ControlValue]> = [],
): OSC.Message {
  const args: (string | number)[] = [defName, nodeId, addAction, targetId];
  for (const [k, v] of pairs) args.push(k, v);
  return new OSC.Message('/s_new', ...args);
}

// ── /s_get, /s_getn, /s_noid ──────────────────────────────────────────

export const sGet = (nodeId: number, ...keys: ControlKey[]): OSC.Message =>
  new OSC.Message('/s_get', nodeId, ...keys);

export const sGetn = (
  nodeId: number,
  ...ranges: ReadonlyArray<[ControlKey, number]>
): OSC.Message => new OSC.Message('/s_getn', nodeId, ...ranges.flat());

export const sNoid = (...nodeIds: number[]): OSC.Message =>
  new OSC.Message('/s_noid', ...nodeIds);

// ── /n_run ────────────────────────────────────────────────────────────

export const nRun = (
  ...pairs: ReadonlyArray<[number, 0 | 1]>
): OSC.Message => new OSC.Message('/n_run', ...pairs.flat());

export const nRunOne = (nodeId: number, flag: 0 | 1): OSC.Message =>
  new OSC.Message('/n_run', nodeId, flag);

// ── /n_free ───────────────────────────────────────────────────────────

export const nFree = (...nodeIds: number[]): OSC.Message =>
  new OSC.Message('/n_free', ...nodeIds);

// ── /n_set / /n_setn / /n_fill ────────────────────────────────────────

export const nSet = (
  nodeId: number,
  controls: SNewControls,
): OSC.Message => {
  const args: (string | number)[] = [nodeId];
  for (const [k, v] of Object.entries(controls)) args.push(k, v);
  return new OSC.Message('/n_set', ...args);
};

export const nSetPairs = (
  nodeId: number,
  pairs: ReadonlyArray<[ControlKey, ControlValue]>,
): OSC.Message => {
  const args: (string | number)[] = [nodeId];
  for (const [k, v] of pairs) args.push(k, v);
  return new OSC.Message('/n_set', ...args);
};

export const nSetn = (
  nodeId: number,
  ...ranges: ReadonlyArray<[ControlKey, number, ...number[]]>
): OSC.Message =>
  new OSC.Message('/n_setn', nodeId, ...ranges.flat() as (string | number)[]);

export const nFill = (
  nodeId: number,
  ...ranges: ReadonlyArray<[ControlKey, number, number]>
): OSC.Message =>
  new OSC.Message('/n_fill', nodeId, ...ranges.flat() as (string | number)[]);

// ── /n_map* ───────────────────────────────────────────────────────────

export const nMap = (
  nodeId: number,
  ...pairs: ReadonlyArray<[ControlKey, number]>
): OSC.Message => new OSC.Message('/n_map', nodeId, ...pairs.flat() as (string | number)[]);

export const nMapn = (
  nodeId: number,
  ...triples: ReadonlyArray<[ControlKey, number, number]>
): OSC.Message => new OSC.Message('/n_mapn', nodeId, ...triples.flat() as (string | number)[]);

export const nMapa = (
  nodeId: number,
  ...pairs: ReadonlyArray<[ControlKey, number]>
): OSC.Message => new OSC.Message('/n_mapa', nodeId, ...pairs.flat() as (string | number)[]);

export const nMapan = (
  nodeId: number,
  ...triples: ReadonlyArray<[ControlKey, number, number]>
): OSC.Message => new OSC.Message('/n_mapan', nodeId, ...triples.flat() as (string | number)[]);

// ── /n_before, /n_after, /n_order, /n_query, /n_trace ─────────────────

export const nBefore = (
  ...pairs: ReadonlyArray<[number, number]>
): OSC.Message => new OSC.Message('/n_before', ...pairs.flat());

export const nAfter = (
  ...pairs: ReadonlyArray<[number, number]>
): OSC.Message => new OSC.Message('/n_after', ...pairs.flat());

export const nOrder = (
  addAction: number,
  targetId: number,
  ...nodeIds: number[]
): OSC.Message => new OSC.Message('/n_order', addAction, targetId, ...nodeIds);

export const nQuery = (...nodeIds: number[]): OSC.Message =>
  new OSC.Message('/n_query', ...nodeIds);

export const nTrace = (...nodeIds: number[]): OSC.Message =>
  new OSC.Message('/n_trace', ...nodeIds);
