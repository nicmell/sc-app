/**
 * Global clock SynthDef. Fires `/tr` replies at `params.tickRate` Hz
 * with `trigId = CLOCK_TRIG_ID` and the running pulse count as the
 * value payload. The `PulseCount` arms on the same `Impulse` so tick
 * index and trigger timing stay phase-locked.
 *
 * Equivalent sclang:
 *     var imp = Impulse.kr(tickRate);
 *     SendTrig.kr(imp, trigId, PulseCount.kr(imp));
 *
 * `trigId` is baked into the compiled bytes — the worker dispatches
 * `/tr` to `clockTick` based on this ID, so it's reserved. `tickRate`
 * is a compile-time closure parameter sourced from the client-side
 * `ClockParams` so there is one source of truth with `deriveClock()`.
 */

import { synthdef } from '@sc-app/synthdef-compiler';
import { CLOCK_TRIG_ID, type ClockParams } from '@/config/clockConfig';

export const CLOCK_SYNTHDEF_NAME = 'globalClock';

const cache = new Map<number, Uint8Array>();

export function compileClockSynthDef(params: ClockParams): Uint8Array {
  const cached = cache.get(params.tickRate);
  if (cached) return cached;

  const def = synthdef(CLOCK_SYNTHDEF_NAME, (g) => {
    const imp = g.Impulse.kr(params.tickRate, 0);
    const count = g.PulseCount.kr(imp, 0);
    g.SendTrig.kr(imp, CLOCK_TRIG_ID, count);
  });

  const bytes = def.toBytes();
  cache.set(params.tickRate, bytes);
  return bytes;
}
