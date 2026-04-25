/**
 * Dev audio sources — sines on a configurable private bus, used to
 * give the scope something recognisable to capture during scope-test
 * verification (Phase 7 mono, Phase 10 multi-channel).
 *
 * Mono and stereo come from separate compiled SynthDefs because
 * SC's `Out.ar(bus, [channel0, channel1, ...])` expects a fixed
 * channel count at compile time. Add an N-channel variant if and
 * when needed (the existing two stay backward-compatible).
 */

import { synthdef } from '@sc-app/synthdef-compiler';

export const TEST_TONE_SYNTHDEF_NAME = 'testTone';
export const TEST_TONE_STEREO_SYNTHDEF_NAME = 'testToneStereo';

let cachedMono: Uint8Array | null = null;
let cachedStereo: Uint8Array | null = null;

export function compileTestToneSynthDef(): Uint8Array {
  if (cachedMono) return cachedMono;
  const def = synthdef(
    TEST_TONE_SYNTHDEF_NAME,
    (g, { outBus = 0, freq = 440, amp = 0.2 }) => {
      g.Out.ar(outBus, g.mul(g.SinOsc.ar(freq, 0), amp));
    },
  );
  cachedMono = def.toBytes();
  return cachedMono;
}

export function compileTestToneStereoSynthDef(): Uint8Array {
  if (cachedStereo) return cachedStereo;
  const def = synthdef(
    TEST_TONE_STEREO_SYNTHDEF_NAME,
    (g, { outBus = 0, freqL = 440, freqR = 660, amp = 0.2 }) => {
      g.Out.ar(outBus, [
        g.mul(g.SinOsc.ar(freqL, 0), amp),
        g.mul(g.SinOsc.ar(freqR, 0), amp),
      ]);
    },
  );
  cachedStereo = def.toBytes();
  return cachedStereo;
}
