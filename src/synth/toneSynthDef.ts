/**
 * User-facing source synths — band-limited oscillators on a
 * configurable private bus, exposed via the Synths panel for the
 * user to wire into scopes / recordings by reading the bus number
 * off the synth's card.
 *
 * Args (all kr controls — set at runtime via `/n_set`):
 *
 *  - `outBus`: where to write the audio (the bus block the manager
 *    auto-allocates per synth).
 *  - `freq` (mono) or `freqL`, `freqR` (stereo): oscillator frequency.
 *  - `amp`: scalar multiplier on the oscillator output.
 *  - `gate`: 0 = silent, 1 = audible. Wrapped in
 *    `Lag.kr(gate, 0.01)` to declick on toggle. Default 1.
 *  - `waveform`: which oscillator to use — 0 = sine, 1 = square,
 *    2 = saw. Implemented via `Select.ar` over a parallel bank of
 *    oscillators so the choice can change live without a /s_new.
 *    Default 0 (sine).
 *
 * Switching waveforms via `Select.ar` runs all three oscillators
 * in parallel and picks one — three SinOsc / Pulse / Saw at full
 * audio rate is negligible CPU. The trade-off is well worth the
 * runtime mutability vs. having to /n_replace the synth.
 *
 * Note on perceived loudness: Pulse and Saw are louder than SinOsc
 * at the same `amp` because they're rich in harmonics. The user
 * can compensate via the amp slider; we don't auto-normalize.
 *
 * Mono and stereo are separate compiled SynthDefs because SC's
 * `Out.ar(bus, [ch0, ch1, ...])` needs a fixed channel count at
 * compile time.
 */

import { synthdef } from '@sc-app/synthdef-compiler';

export function toneSynthDefName(channels: 1 | 2): string {
  return `tone${channels}ch`;
}

const cache = new Map<number, Uint8Array>();

export function compileToneSynthDef(channels: 1 | 2): Uint8Array {
  const cached = cache.get(channels);
  if (cached) return cached;

  const name = toneSynthDefName(channels);
  const def =
    channels === 1
      ? synthdef(
          name,
          (
            g,
            { outBus = 0, freq = 440, amp = 0.2, gate = 1, waveform = 0 },
          ) => {
            const env = g.Lag.kr(gate, 0.01);
            const sig = g.Select.ar(waveform, [
              g.SinOsc.ar(freq, 0),
              g.Pulse.ar(freq, 0.5),
              g.Saw.ar(freq),
            ]);
            g.Out.ar(outBus, g.mul(g.mul(sig, amp), env));
          },
        )
      : synthdef(
          name,
          (
            g,
            {
              outBus = 0,
              freqL = 440,
              freqR = 660,
              amp = 0.2,
              gate = 1,
              waveform = 0,
            },
          ) => {
            const env = g.Lag.kr(gate, 0.01);
            const left = g.Select.ar(waveform, [
              g.SinOsc.ar(freqL, 0),
              g.Pulse.ar(freqL, 0.5),
              g.Saw.ar(freqL),
            ]);
            const right = g.Select.ar(waveform, [
              g.SinOsc.ar(freqR, 0),
              g.Pulse.ar(freqR, 0.5),
              g.Saw.ar(freqR),
            ]);
            g.Out.ar(outBus, [
              g.mul(g.mul(left, amp), env),
              g.mul(g.mul(right, amp), env),
            ]);
          },
        );

  const bytes = def.toBytes();
  cache.set(channels, bytes);
  return bytes;
}
