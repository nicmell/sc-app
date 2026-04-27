/**
 * Recorder tap — reads an audio bus and writes it into a buffer at full
 * audio rate, wrapping at `2 × chunkSize`. The clock's `/tr` fires
 * every `chunkSize` audio samples (since `samplesPerTick = chunkSize`
 * with decimation = 1), so each tick marks the moment one half of the
 * buffer has just completed: the worker reads that half via `/b_getn`
 * and appends it to an in-memory WAV.
 *
 * Mirrors `scopeSynthDef`'s clockBus-driven `writeIdx` — same shape,
 * same parity. Reading the global `clockBus` phasor instead of a local
 * `Phasor.ar` is what lets the worker reuse the scope's
 * `completedHalf = tickIndex % 2` parity formula: clockBus has been
 * advancing since clock /s_new at session start, so absolute tick
 * parity always aligns with the half boundaries. A local Phasor would
 * have its own zero (the moment /s_new fires for *this* recorder), and
 * depending on whether `startTick` was even or odd, every read would
 * land on the wrong half — the bug we hit before this rewrite.
 *
 * Group-tail placement is required: the clock synth (at head) must
 * have written `clockBus` on the same control block before this
 * synth reads it. Inputs (e.g. testTone) must also be at-or-before
 * this synth in the group order — same constraint as the scope.
 *
 * Compiled per (channels, chunkSize) tuple. `chunkSize` is mutable
 * at runtime via the header dropdown, so the cache key must include
 * it — caching by `channels` alone would serve stale bytes after a
 * re-init.
 */

import {
  synthdef,
  ugenIndex,
  uo,
  type UGenInput,
} from '@sc-app/synthdef-compiler';

export function recorderSynthDefName(
  channels: number,
  chunkSize: number,
): string {
  return `recorderTap${channels}ch_${chunkSize}`;
}

const cache = new Map<string, Uint8Array>();

export function compileRecorderSynthDef(
  channels: number,
  chunkSize: number,
): Uint8Array {
  if (!Number.isInteger(channels) || channels < 1) {
    throw new Error(
      `compileRecorderSynthDef: channels must be a positive integer, got ${channels}`,
    );
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error(
      `compileRecorderSynthDef: chunkSize must be a positive integer, got ${chunkSize}`,
    );
  }
  const name = recorderSynthDefName(channels, chunkSize);
  const cached = cache.get(name);
  if (cached) return cached;

  const ring = chunkSize * 2;

  const def = synthdef(
    name,
    (g, { inBus = 0, bufnum = 0, clockBus = 0 }) => {
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
      // Read the shared clockBus phasor and use it directly as the
      // write index. clockBus advances by 1 per audio frame and wraps
      // at `2 × chunkSize` (CLOCK_WRAP_TICKS=2), so this gives exactly
      // one full audio-rate write per frame, with the wrap perfectly
      // aligned to tick boundaries.
      const phase = g.In.ar(clockBus, 1);
      const writeIdx = g.mod(phase, ring);
      g.BufWr.ar(sigs, bufnum, writeIdx);
    },
  );

  const bytes = def.toBytes();
  cache.set(name, bytes);
  return bytes;
}
