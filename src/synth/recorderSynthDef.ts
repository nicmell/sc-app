/**
 * Recorder tap — reads an audio bus and writes it into a buffer at full
 * audio rate, wrapping at `2 × samplesPerTick`. The clock's `/tr` fires
 * every `samplesPerTick` audio samples, so each tick marks the moment
 * one half of the buffer has just completed: the worker reads that
 * half via `/b_getn` and appends it to an in-memory WAV.
 *
 * Differs from `scopeSynthDef` in two ways:
 *
 *  - **No clock bus dependency.** The recorder uses a *local* `Phasor.ar`
 *    starting at 0 when /s_new fires. Combined with the worker's
 *    "skip first chunk" heuristic (and optional sample-accurate
 *    bundle scheduling against `tickToTimetag`), each tick still
 *    marks a clean completed half.
 *  - **No decimation.** The recorder writes every sample (`step = 1`),
 *    so the WAV is full-rate audio.
 *
 * Compiled per channel count: `In.ar(bus, channels)` and `BufWr.ar`
 * need a fixed channel count at SynthDef compile time. We cache one
 * SynthDef per `channels` value seen.
 */

import {
  synthdef,
  ugenIndex,
  uo,
  type UGenInput,
} from '@sc-app/synthdef-compiler';
import { DEFAULT_ENV, DEFAULT_PARAMS } from '@/config/clockConfig';

export function recorderSynthDefName(channels: number): string {
  return `recorderTap${channels}ch`;
}

const cache = new Map<number, Uint8Array>();

export function compileRecorderSynthDef(channels = 1): Uint8Array {
  if (channels < 1 || !Number.isInteger(channels)) {
    throw new Error(
      `compileRecorderSynthDef: channels must be a positive integer, got ${channels}`,
    );
  }
  const cached = cache.get(channels);
  if (cached) return cached;

  // recChunkSize × 2 = ring length in samples-per-channel. We bake
  // samplesPerTick from DEFAULT_PARAMS — the worker's tick-driven read
  // loop is parameterised by this same value, so the synthdef and
  // worker must agree at compile time.
  const samplesPerTick = DEFAULT_ENV.sampleRate / DEFAULT_PARAMS.tickRate;
  const ring = samplesPerTick * 2;

  const def = synthdef(
    recorderSynthDefName(channels),
    (g, { inBus = 0, bufnum = 0 }) => {
      // Same fan-out trick as the scope synth: `In.ar(bus, channels)`
      // returns a single UGenInput pointing at output 0; `BufWr.ar`
      // would silently drop the rest. Walk the UGen's outputs
      // explicitly so all channels land in the buffer interleaved.
      const inUgen = g.In.ar(inBus, channels);
      const inIdx = ugenIndex(inUgen);
      if (inIdx === null) {
        throw new Error(
          'compileRecorderSynthDef: In.ar did not return a UGen ref',
        );
      }
      const sigs: UGenInput[] = [];
      for (let c = 0; c < channels; c++) {
        sigs.push(uo(inIdx, c));
      }
      // Phasor.ar(trig, rate, start, end) — local sawtooth from 0 to
      // `ring - 1`, advancing one sample per audio frame, wrapping
      // at `ring`. trig=0 means "free-running, never reset after the
      // initial zero sample".
      const phase = g.Phasor.ar(0, 1, 0, ring);
      g.BufWr.ar(sigs, bufnum, phase);
    },
  );

  const bytes = def.toBytes();
  cache.set(channels, bytes);
  return bytes;
}
