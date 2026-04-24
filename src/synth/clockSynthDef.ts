/**
 * Global clock SynthDef. Fires `/tr` replies at `params.tickRate` Hz
 * with `trigId = CLOCK_TRIG_ID` and the running pulse count as the
 * value payload. The PulseCount arms on the same Impulse so tick
 * index and trigger timing stay phase-locked.
 *
 * Equivalent sclang:
 *     var imp = Impulse.kr(tickRate);
 *     SendTrig.kr(imp, trigId, PulseCount.kr(imp));
 *
 * `trigId` is baked into the compiled bytes (no synth arg) — it is
 * the reserved worker-dispatch key. `tickRate` is a compile-time
 * parameter threaded from the client-side `ClockParams` so there is
 * one source of truth with `deriveClock()`.
 */

import { core, ugens } from '@wasm/scsynthdef-compiler';
import type { UgenInput } from '@wasm/scsynthdef-compiler/interfaces/scsynthdef-compiler-core';
import { CLOCK_TRIG_ID, type ClockParams } from '@/config/clockConfig';

const k = (v: number): UgenInput => ({ tag: 'constant', val: v });

export const CLOCK_SYNTHDEF_NAME = 'globalClock';

const cache = new Map<number, Uint8Array>();

export function compileClockSynthDef(params: ClockParams): Uint8Array {
  const cached = cache.get(params.tickRate);
  if (cached) return cached;

  const def = new core.SynthDef(CLOCK_SYNTHDEF_NAME);
  const imp = ugens.impulse(def, 'control', { freq: k(params.tickRate) });
  const count = ugens.pulseCount(def, 'control', { trig: imp });
  ugens.sendTrig(def, 'control', {
    in: imp,
    id: k(CLOCK_TRIG_ID),
    value: count,
  });

  const bytes = def.toBytes();
  cache.set(params.tickRate, bytes);
  return bytes;
}
