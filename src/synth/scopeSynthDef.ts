/**
 * Scope tap — reads an audio bus and writes it into a ring buffer
 * indexed by the clock's shared sample phase.
 *
 * The scope owns `decimation` and `scopeChunkSize` (both baked at
 * compile time from `DEFAULT_PARAMS`); the clock is oblivious. Each
 * scope frame is written at
 *     writeIdx = (clockPhase / decimation) mod (scopeChunkSize × 2)
 * which for the default 48000/46.875/256/4 config gives an integer
 * index stepping +1 every 4 audio samples and wrapping at 512.
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
 * Compiled per channel count: SC's `In.ar(bus, channels)` and
 * `BufWr.ar` need a fixed channel count at compile time. We cache
 * one SynthDef per `channels` value seen.
 */

import { synthdef, ugenIndex, uo, type UGenInput } from '@sc-app/synthdef-compiler';
import { DEFAULT_PARAMS } from '@/config/clockConfig';

export function scopeSynthDefName(channels: number): string {
  return `scopeTap${channels}ch`;
}

const cache = new Map<number, Uint8Array>();

export function compileScopeSynthDef(channels = 1): Uint8Array {
  if (channels < 1 || !Number.isInteger(channels)) {
    throw new Error(
      `compileScopeSynthDef: channels must be a positive integer, got ${channels}`,
    );
  }
  const cached = cache.get(channels);
  if (cached) return cached;

  const decimation = DEFAULT_PARAMS.decimation;
  const ring = DEFAULT_PARAMS.scopeChunkSize * 2;

  const def = synthdef(
    scopeSynthDefName(channels),
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
        // Defensive — ugenIndex returns null only for `constant`
        // inputs, which `In.ar` never produces.
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
  cache.set(channels, bytes);
  return bytes;
}
