/**
 * Shared type primitives. We deliberately *don't* ship a custom
 * discriminated union for every OSC address; `OSC.Message` and
 * `OSC.Bundle` from osc-js already represent all messages
 * structurally as `{ address, args }` and `{ timetag, bundleElements }`.
 * Reply filtering matches on `msg.address` directly.
 */

/** OSC atomic types we use on the wire: int32, float32, string, blob. */
export type OscArg = number | string | Uint8Array;

/** Control can be addressed by name (string) or zero-based index (int). */
export type ControlKey = string | number;

/** Control values are numbers or bus-map strings like `"c10"` / `"a2"`. */
export type ControlValue = number | string;
