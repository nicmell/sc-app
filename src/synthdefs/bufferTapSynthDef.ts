/**
 * Buffer tap — reads an audio bus and writes it into a ring buffer
 * indexed by the clock's shared sample phase. The single tap synth
 * for every consumer kind: scopes, recorders, future analyzers.
 * Phase 18 unified the previously parallel `scopeTap` and
 * `recorderTap` SynthDefs (which were byte-identical modulo name)
 * into this single source.
 *
 * Each frame is written at
 *     writeIdx = clockPhase mod (chunkSize × 2)
 * which at the default `chunkSize = 1024` wraps cleanly on every
 * tick boundary — one half completes per tick, and the worker's
 * `completedHalf = tickIndex % 2` parity formula matches it.
 *
 * Reading the global `clockBus` phasor (rather than a local
 * `Phasor.ar`) is what lets the worker reuse the parity formula:
 * clockBus has been advancing since clock /s_new at session start,
 * so absolute tick parity always aligns with the half boundaries.
 * A local Phasor would have its own zero (the moment /s_new fires
 * for *this* tap), and depending on whether `startTick` was even
 * or odd, every read would land on the wrong half — the bug we
 * hit before the clockBus rewrite.
 *
 * Decimation is fixed at 1: every audio sample lands in the
 * buffer.
 *
 * Placed at group-tail so the clock (at head) has already written
 * `clockBus` on the same control block. Producer synths (e.g.
 * `tone1ch` / `tone2ch` from the Synths panel) must also be
 * at-or-before this synth in the group order — i.e. created first
 * (the UX flow "add a synth, then add a consumer on its bus" gets
 * this right naturally; both producer and tap go AddToTail and
 * insertion order = runtime order).
 *
 * Compiled per `(channels, chunkSize)` tuple: SC's `In.ar(bus,
 * channels)` and `BufWr.ar` need a fixed channel count at compile
 * time, and the ring size is baked into the `mod`. We cache one
 * SynthDef per unique tuple seen.
 */

import {
  synthdef,
  ugenIndex,
  uo,
  type UGenInput,
} from '@sc-app/synthdef-compiler';

export function bufferTapSynthDefName(
  channels: number,
  chunkSize: number,
): string {
  return `bufferTap${channels}ch_${chunkSize}`;
}

const cache = new Map<string, Uint8Array>();

export function compileBufferTapSynthDef(
  channels: number,
  chunkSize: number,
): Uint8Array {
  if (!Number.isInteger(channels) || channels < 1) {
    throw new Error(
      `compileBufferTapSynthDef: channels must be a positive integer, got ${channels}`,
    );
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error(
      `compileBufferTapSynthDef: chunkSize must be a positive integer, got ${chunkSize}`,
    );
  }
  const name = bufferTapSynthDefName(channels, chunkSize);
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
        throw new Error(
          'compileBufferTapSynthDef: In.ar did not return a UGen ref',
        );
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
