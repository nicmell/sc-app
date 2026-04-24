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

/** JS timestamp (ms since Unix epoch) accepted by `new OSC.Bundle(t, …)`. */
export type Timetag = number;

/** "Fire as soon as possible." osc-js encodes this as the special
 *  NTP timetag `(0, 1)`. */
export function immediate(): Timetag {
  return 0;
}

/** Absolute JS ms timestamp. Convenience alias for readability. */
export function atDate(ms: number): Timetag {
  return ms;
}

/** `Date.now() + offsetMs`. Used by the main thread to wrap live
 *  commands in a latency budget so scsynth always sees them in the
 *  future and there's no risk of late delivery. */
export function inFuture(offsetMs: number): Timetag {
  return Date.now() + offsetMs;
}

/** Given an NTP anchor captured at tick 0 (the JS ms time at which
 *  tick 0 was received), return the JS ms time corresponding to
 *  `tickIndex`. Any scheduled bundle carrying this timetag will fire
 *  at that sample-accurate tick boundary. */
export function fromTick(
  tick0Ms: number,
  tickIndex: number,
  tickRate: number,
): Timetag {
  return tick0Ms + (tickIndex * 1000) / tickRate;
}
