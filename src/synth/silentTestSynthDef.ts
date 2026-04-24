/**
 * Phase 4 dev heartbeat — a silent synth that fires `/tr` replies at 5 Hz
 * with `trigId = 9999` and the running pulse count as the payload. Proves
 * `/n_run` on the parent group reaches its children.
 *
 * Equivalent sclang:
 *     var imp = Impulse.kr(5);
 *     SendTrig.kr(imp, 9999, PulseCount.kr(imp));
 *
 * The shared `imp` matters — two independent `Impulse.kr(5)` would drift.
 */

import { core, ugens } from '@wasm/scsynthdef-compiler';
import type { UgenInput } from '@wasm/scsynthdef-compiler/interfaces/scsynthdef-compiler-core';

const k = (v: number): UgenInput => ({ tag: 'constant', val: v });

export const SILENT_TEST_TRIG_ID = 9999;

let cached: Uint8Array | null = null;

export function compileSilentTestSynthDef(): Uint8Array {
  if (cached) return cached;
  const def = new core.SynthDef('silentTest');
  const imp = ugens.impulse(def, 'control', { freq: k(5) });
  const count = ugens.pulseCount(def, 'control', { trig: imp });
  ugens.sendTrig(def, 'control', {
    in: imp,
    id: k(SILENT_TEST_TRIG_ID),
    value: count,
  });
  cached = def.toBytes();
  return cached;
}
