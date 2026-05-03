/**
 * @sc-app/server-commands — scsynth OSC messaging layer for the app.
 *
 * Wraps `osc-js`. Callers work with `OSC.Message` and `OSC.Bundle`
 * directly; these helpers provide the per-address constructors,
 * typed reply accessors, and timetag helpers for sample-accurate
 * scheduling.
 *
 * ```ts
 * import OSC from 'osc-js';
 * import { sNew, AddToHead, encode, inFuture } from '@sc-app/server-commands';
 *
 * const msg = sNew('myDef', 1001, AddToHead, 100);
 * const bundle = new OSC.Bundle([msg], inFuture(200));  // fire in 200 ms
 * const bytes = encode(bundle);
 * ```
 */

// Re-export osc-js as the default "OSC" symbol for ergonomic imports.
export { default as OSC } from 'osc-js';

// Binary <-> osc-js.
export { encode, decode, isBundle, isMessage, type OscPacket } from './encode';

// Timetag helpers.
export * as timetag from './timetag';
export { fromTick as tickToTimetag, immediate, inFuture, atDate, type Timetag } from './timetag';

// Type primitives.
export type { OscArg, ControlKey, ControlValue } from './types';

// Command constructors.
export * from './commands';

// Typed reply accessors.
export * from './replies';
