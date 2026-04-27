/**
 * Scope tap — reads an audio bus and writes it into a ring buffer
 * indexed by the clock's shared sample phase.
 *
 * The scope owns `chunkSize` and `decimation` (both baked at compile
 * time per call); the clock is oblivious. Each scope frame is
 * written at
 *     writeIdx = (clockPhase / decimation) mod (chunkSize × 2)
 * which for the default 48000/46.875/256/4 config gives an integer
 * index stepping +1 every 4 audio samples and wrapping at 512.
 *
 * The invariant `chunkSize × decimation = samplesPerTick` (= 1024
 * with the current clock) is what makes the worker's
 * `completedHalf = tickIndex % 2` parity formula work: each tick
 * fires exactly when the writeIdx has just wrapped a half boundary.
 *
 * `BufWr.ar` writes every audio sample — so each buffer slot is
 * overwritten `decimation` times in a row, and the last write wins.
 * Effectively a zero-order-hold decimation, which is fine for a
 * time-domain scope display above the alias frequency.
 *
 * Placed at group-tail so the clock (at head) has already written
 * `clockBus` on the same control block. Inputs (e.g. testTone)
 * must also be at-or-before this synth in the group order.
 *
 * Compiled per (channels, chunkSize, decimation) tuple: SC's
 * `In.ar(bus, channels)` and `BufWr.ar` need a fixed channel count
 * at compile time, and `decimation`/`ring` are also baked. We cache
 * one SynthDef per unique tuple seen.
 */

import {
  synthdef,
  ugenIndex,
  uo,
  type UGenInput,
} from '@sc-app/synthdef-compiler';

export function scopeSynthDefName(
  channels: number,
  chunkSize: number,
  decimation: number,
): string {
  return `scopeTap${channels}ch_${chunkSize}_${decimation}`;
}

const cache = new Map<string, Uint8Array>();

export function compileScopeSynthDef(
  channels: number,
  chunkSize: number,
  decimation: number,
): Uint8Array {
  if (!Number.isInteger(channels) || channels < 1) {
    throw new Error(
      `compileScopeSynthDef: channels must be a positive integer, got ${channels}`,
    );
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error(
      `compileScopeSynthDef: chunkSize must be a positive integer, got ${chunkSize}`,
    );
  }
  if (!Number.isInteger(decimation) || decimation < 1) {
    throw new Error(
      `compileScopeSynthDef: decimation must be a positive integer, got ${decimation}`,
    );
  }
  const name = scopeSynthDefName(channels, chunkSize, decimation);
  const cached = cache.get(name);
  if (cached) return cached;

  const ring = chunkSize * 2;

  const def = synthdef(
    name,
    (g, { inBus = 0, bufnum = 0, clockBus = 0 }) => {
      // `In.ar(bus, channels)` registers an N-output UGen, but the
      // sugar returns a single `UGenInput` pointing at output 0
      // only. Passing that directly to `BufWr.ar(sig)` would wire
      // up channel 0 and silently drop the rest, leaving every
      // other lane flat. Explicitly fan the In UGen's outputs into
      // an array of UGenInputs (one per output) so BufWr writes
      // all channels interleaved into the N-channel buffer.
      const inUgen = g.In.ar(inBus, channels);
      const inIdx = ugenIndex(inUgen);
      if (inIdx === null) {
        throw new Error('compileScopeSynthDef: In.ar did not return a UGen ref');
      }
      const sigs: UGenInput[] = [];
      for (let c = 0; c < channels; c++) {
        sigs.push(uo(inIdx, c));
      }
      const phase = g.In.ar(clockBus, 1);
      const writeIdx = g.mod(g.div(phase, decimation), ring);
      g.BufWr.ar(sigs, bufnum, writeIdx);
    },
  );

  const bytes = def.toBytes();
  cache.set(name, bytes);
  return bytes;
}
