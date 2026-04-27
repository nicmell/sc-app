/**
 * Scope tap — reads an audio bus and writes it into a ring buffer
 * indexed by the clock's shared sample phase.
 *
 * The scope owns `chunkSize` (baked at compile time per call); the
 * clock is oblivious. Each scope frame is written at
 *     writeIdx = clockPhase mod (chunkSize × 2)
 * which at the default `chunkSize = 1024` wraps cleanly on every
 * tick boundary — one half completes per tick, and the worker's
 * `completedHalf = tickIndex % 2` parity formula matches it.
 *
 * Decimation is fixed at 1: every audio sample lands in the
 * buffer. No anti-aliasing concerns, full-rate visual fidelity. The
 * trade-off vs the old `decimation = 4` pattern is bandwidth — a
 * 1024-sample chunk is 4 KB on the wire vs 1 KB for the decimated
 * 256-sample one — but at 47 Hz tick rate that's ~190 KB/s mono,
 * trivial.
 *
 * Placed at group-tail so the clock (at head) has already written
 * `clockBus` on the same control block. Inputs (e.g. testTone)
 * must also be at-or-before this synth in the group order.
 *
 * Compiled per (channels, chunkSize) tuple: SC's `In.ar(bus,
 * channels)` and `BufWr.ar` need a fixed channel count at compile
 * time, and the ring size is baked too. We cache one SynthDef per
 * unique tuple seen.
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
): string {
  return `scopeTap${channels}ch_${chunkSize}`;
}

const cache = new Map<string, Uint8Array>();

export function compileScopeSynthDef(
  channels: number,
  chunkSize: number,
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
  const name = scopeSynthDefName(channels, chunkSize);
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
      const writeIdx = g.mod(phase, ring);
      g.BufWr.ar(sigs, bufnum, writeIdx);
    },
  );

  const bytes = def.toBytes();
  cache.set(name, bytes);
  return bytes;
}
