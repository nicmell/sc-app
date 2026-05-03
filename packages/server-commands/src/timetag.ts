/**
 * Timetag helpers for scheduling OSC bundles against scsynth's
 * sample-accurate queue.
 *
 * scsynth reads the 64-bit NTP timetag off every bundle; if it's in
 * the future the bundle sits in a priority queue and fires at exactly
 * that audio sample. `osc-js` converts between JS timestamps
 * (ms since the Unix epoch) and NTP for us, so `Bundle`'s timetag
 * argument just wants a JS ms value. This module provides ergonomic
 * constructors for the common cases.
 */

/** JS timestamp (ms since Unix epoch) accepted by `new OSC.Bundle(t, …)`.
 *
 *  IMPORTANT: must be an **integer**. osc-js's Bundle constructor checks
 *  `isInt(arg)` for the timetag and silently falls back to `Date.now()`
 *  if the value is fractional (`node_modules/osc-js/lib/osc.js`,
 *  line 850). All helpers in this module round their result to an
 *  integer; callers that compute their own timetag must do the same. */
export type Timetag = number;

/** "Fire as soon as possible." osc-js encodes this as the special
 *  NTP timetag `(0, 1)`. */
export function immediate(): Timetag {
  return 0;
}

/** Absolute JS ms timestamp. Convenience alias for readability.
 *  Rounded — see Timetag type comment. */
export function atDate(ms: number): Timetag {
  return Math.round(ms);
}

/** `Date.now() + offsetMs`. Used by the main thread to wrap live
 *  commands in a latency budget so scsynth always sees them in the
 *  future and there's no risk of late delivery. Rounded — see Timetag
 *  type comment. */
export function inFuture(offsetMs: number): Timetag {
  return Math.round(Date.now() + offsetMs);
}

/** Given an NTP anchor captured at tick 0 (the JS ms time at which
 *  tick 0 was received), return the JS ms time corresponding to
 *  `tickIndex`. Any scheduled bundle carrying this timetag will fire
 *  at that sample-accurate tick boundary.
 *
 *  Rounded to integer ms because `OSC.Bundle`'s constructor silently
 *  drops fractional timetags (see Timetag type comment). The 1-ms
 *  quantization is well below scsynth's audio-callback jitter and the
 *  tick-rate granularity, so it's a no-op for sample-accurate use. */
export function fromTick(
  tick0Ms: number,
  tickIndex: number,
  tickRate: number,
): Timetag {
  return Math.round(tick0Ms + (tickIndex * 1000) / tickRate);
}
