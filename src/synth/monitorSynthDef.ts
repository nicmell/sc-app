/**
 * Mono monitor — copies a private audio bus to a hardware output bus
 * so you can hear what's on the bus without re-routing the source.
 *
 * Used by `ScopeTestPanel` to optionally pipe the test tone to the
 * speakers while keeping the scope tap reading from the private bus.
 */

import { synthdef } from '@sc-app/synthdef-compiler';

export const MONITOR_SYNTHDEF_NAME = 'monitor';

let cached: Uint8Array | null = null;

export function compileMonitorSynthDef(): Uint8Array {
  if (cached) return cached;

  const def = synthdef(
    MONITOR_SYNTHDEF_NAME,
    (g, { inBus = 0, outBus = 0, amp = 1 }) => {
      g.Out.ar(outBus, g.mul(g.In.ar(inBus, 1), amp));
    },
  );

  cached = def.toBytes();
  return cached;
}
