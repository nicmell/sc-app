/**
 * Global clock SynthDef. Two outputs:
 *
 * 1. **Tick stream.** `SendTrig.kr` fires `/tr` at `tickRate` Hz with
 *    `trigId = CLOCK_TRIG_ID` and the running pulse count as the
 *    value. The worker demuxes these into a dedicated tick channel.
 *
 * 2. **Shared sample phase.** An audio-rate sample counter published
 *    on the `clockBus` control-addressed bus. Increments `+1` per
 *    audio sample, wraps every `CLOCK_WRAP_TICKS × samplesPerTick`
 *    samples (= 2 tick periods at the default config). This is the
 *    only coupling the clock exposes to downstream synths — scope
 *    and recorder synths derive their own write index from this
 *    shared phase, using their own ring-size parameters.
 *
 * Equivalent sclang:
 *     var tick = Impulse.kr(tickRate);
 *     SendTrig.kr(tick, trigId, PulseCount.kr(tick));
 *     Out.ar(clockBus, Phasor.ar(0, 1, 0, wrapTicks * SampleRate.ir / tickRate));
 *
 * `tickRate` is a compile-time parameter — `Impulse.kr` accepts a
 * literal Hz value, baked into the SynthDef bytes. With the runtime
 * sampleRate model (Phase 13.5+) and global mutable chunkSize, the
 * clock is recompiled per session and per chunkSize change. Cache
 * key is the tickRate value.
 *
 * `clockBus` is a synth control (passed via `/s_new`) so one
 * compiled SynthDef works across sessions with different bus
 * allocations.
 */

import { synthdef } from '@sc-app/synthdef-compiler';
import { CLOCK_TRIG_ID, CLOCK_WRAP_TICKS } from '@/config/clockConfig';

export const CLOCK_SYNTHDEF_NAME = 'globalClock';

const cache = new Map<number, Uint8Array>();

export function compileClockSynthDef(tickRate: number): Uint8Array {
  if (!Number.isFinite(tickRate) || tickRate <= 0) {
    throw new Error(
      `compileClockSynthDef: tickRate must be positive and finite, got ${tickRate}`,
    );
  }
  const cached = cache.get(tickRate);
  if (cached) return cached;

  const def = synthdef(CLOCK_SYNTHDEF_NAME, (g, { clockBus = 0 }) => {
    const tick = g.Impulse.kr(tickRate, 0);
    const count = g.PulseCount.kr(tick, 0);
    g.SendTrig.kr(tick, CLOCK_TRIG_ID, count);

    // Wrap = CLOCK_WRAP_TICKS × (SampleRate / tickRate). Computed at
    // synth-spawn time via SampleRate.ir so it's correct against the
    // server's actual sample rate, not our client-side guess.
    const wrap = g.mul(g.SampleRate.ir(), CLOCK_WRAP_TICKS / tickRate);
    const samplePhase = g.Phasor.ar(0, 1, 0, wrap);
    g.Out.ar(clockBus, samplePhase);
  });

  const bytes = def.toBytes();
  cache.set(tickRate, bytes);
  return bytes;
}
