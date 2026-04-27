/**
 * User-facing source synths — sines on a configurable private bus,
 * exposed via the Synths panel for the user to wire into scopes /
 * recordings by reading the bus number off the synth's card.
 *
 * Replaces the older `testTone` / `testToneStereo` SynthDefs that
 * scope cards used to bundle automatically. Now they're independent
 * producers managed by `SynthManager` — the scope side is purely a
 * consumer.
 *
 * Args (all kr controls — set at runtime via `/n_set`):
 *
 *  - `outBus`: where to write the audio (the bus block the manager
 *    auto-allocates per synth).
 *  - `freq` (mono) or `freqL`, `freqR` (stereo): sine frequencies.
 *  - `amp`: scalar multiplier on the SinOsc output.
 *  - `gate`: 0 = silent, 1 = audible. Wrapped in `Lag.kr(gate, 0.01)`
 *    to declick on toggle. Default 1 so the synth plays as soon as
 *    `/s_new` lands (matches the previous bundled-source UX).
 *
 * Mono and stereo are separate compiled SynthDefs because SC's
 * `Out.ar(bus, [ch0, ch1, ...])` needs a fixed channel count at
 * compile time. Add an N-channel variant if/when needed; the
 * existing two are sufficient for the panel's mono/stereo selector.
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
      ? synthdef(name, (g, { outBus = 0, freq = 440, amp = 0.2, gate = 1 }) => {
          const env = g.Lag.kr(gate, 0.01);
          g.Out.ar(outBus, g.mul(g.mul(g.SinOsc.ar(freq, 0), amp), env));
        })
      : synthdef(
          name,
          (
            g,
            { outBus = 0, freqL = 440, freqR = 660, amp = 0.2, gate = 1 },
          ) => {
            const env = g.Lag.kr(gate, 0.01);
            g.Out.ar(outBus, [
              g.mul(g.mul(g.SinOsc.ar(freqL, 0), amp), env),
              g.mul(g.mul(g.SinOsc.ar(freqR, 0), amp), env),
            ]);
          },
        );

  const bytes = def.toBytes();
  cache.set(channels, bytes);
  return bytes;
}
