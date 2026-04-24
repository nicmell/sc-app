/**
 * Control-bus commands (/c_*). Control buses are the global scalar
 * namespace shared across synths — distinct from buffer memory.
 */

import OSC from 'osc-js';

export const cSet = (
  ...pairs: ReadonlyArray<[number, number]>
): OSC.Message => new OSC.Message('/c_set', ...pairs.flat());

/** `/c_setn startBus numValues v1 v2 …` — one contiguous run. */
export const cSetn = (
  startBus: number,
  values: readonly number[],
): OSC.Message =>
  new OSC.Message('/c_setn', startBus, values.length, ...values);

export const cFill = (
  ...ranges: ReadonlyArray<[number, number, number]>
): OSC.Message => new OSC.Message('/c_fill', ...ranges.flat());

export const cGet = (...busIndices: number[]): OSC.Message =>
  new OSC.Message('/c_get', ...busIndices);

/** `/c_getn startBus count` — single range. */
export const cGetn = (startBus: number, count: number): OSC.Message =>
  new OSC.Message('/c_getn', startBus, count);
