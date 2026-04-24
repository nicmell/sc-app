/**
 * Dev audio source — a plain sine on a configurable private bus.
 * Exists only to give the scope tap something recognisable to
 * capture during Phase 7 verification.
 */

import { synthdef } from '@sc-app/synthdef-compiler';

export const TEST_TONE_SYNTHDEF_NAME = 'testTone';

let cached: Uint8Array | null = null;

export function compileTestToneSynthDef(): Uint8Array {
  if (cached) return cached;

  const def = synthdef(
    TEST_TONE_SYNTHDEF_NAME,
    (g, { outBus = 0, freq = 440, amp = 0.2 }) => {
      g.Out.ar(outBus, g.mul(g.SinOsc.ar(freq, 0), amp));
    },
  );

  cached = def.toBytes();
  return cached;
}
