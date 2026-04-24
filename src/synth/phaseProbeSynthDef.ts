/**
 * Dev-only diagnostic synth: reads the clock's shared sample phase
 * bus and emits it as `/tr` replies at `replyRate` Hz.
 *
 * Used by `ClockController.probePhase()` to verify that the clock
 * is actually publishing a valid sawtooth on the expected bus. If
 * Phase 7's scope display breaks, the probe tells you whether the
 * bus is the problem or the scope's reader is.
 *
 * Placed at the tail of the parent group so it reads the bus *after*
 * the clock (at head) has written it on the same control block.
 */

import { synthdef } from '@sc-app/synthdef-compiler';
import { PHASE_PROBE_TRIG_ID } from '@/config/clockConfig';

export const PHASE_PROBE_SYNTHDEF_NAME = 'phaseProbe';

let cached: Uint8Array | null = null;

export function compilePhaseProbeSynthDef(): Uint8Array {
  if (cached) return cached;

  const def = synthdef(
    PHASE_PROBE_SYNTHDEF_NAME,
    (g, { clockBus = 0, replyRate = 10 }) => {
      const phase = g.In.ar(clockBus, 1);
      const trig = g.Impulse.kr(replyRate, 0);
      g.SendTrig.kr(trig, PHASE_PROBE_TRIG_ID, g.A2K.kr(phase));
    },
  );

  cached = def.toBytes();
  return cached;
}
