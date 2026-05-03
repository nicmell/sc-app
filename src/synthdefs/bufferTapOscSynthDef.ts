/**
 * OSC fallback tap (Phase 36). Sibling of `bufferTapSynthDef`
 * (which uses ScopeOut2.ar → SHM). This variant uses BufWr.ar
 * to write into a regular `/b_alloc`'d buffer; the bridge polls
 * the buffer via `/b_getn` on each observed `/clock/tick` and
 * intercepts the matching `/b_setn` reply (see
 * `src-tauri/src/scope_osc.rs`).
 *
 * The buffer is a 2-half ring of `2 × chunkSize` frames. The
 * writeIdx is derived from `In.ar(clockBus)` (a sample-counting
 * Phasor.ar published by sclang's `\scAppClock`) wrapping every
 * `2 × chunkSize` samples. This keeps half boundaries
 * sample-aligned with global tick parity, so the bridge knows
 * exactly which half to read from based on the observed
 * tick index. Pre-31 architecture; Phase 31 retired this in
 * favor of ScopeOut2 + SHM; Phase 36 brings it back as the
 * fallback when SHM isn't reachable.
 *
 * Group-order invariant unchanged from the SHM tap: producer
 * synths writing to `inBus` must be at-or-before this tap in
 * the parent group's child order. The clockBus producer
 * (`\scAppClock`) lives at the root group's HEAD, so it always
 * runs first; tap synths in the parent group inherit the right
 * ordering by being `AddToTail` (default for sc-app).
 *
 * Compiled per `(channels, chunkSize)`. The bufnum + clockBus
 * are synth controls so one compiled SynthDef serves N taps
 * with different bufnums.
 */

import {
  synthdef,
  ugenIndex,
  uo,
  type UGenInput,
} from '@sc-app/synthdef-compiler';

export function bufferTapOscSynthDefName(
  channels: number,
  chunkSize: number,
): string {
  return `bufferTapOsc${channels}ch_${chunkSize}`;
}

const cache = new Map<string, Uint8Array>();

export function compileBufferTapOscSynthDef(
  channels: number,
  chunkSize: number,
): Uint8Array {
  if (!Number.isInteger(channels) || channels < 1) {
    throw new Error(
      `compileBufferTapOscSynthDef: channels must be a positive integer, got ${channels}`,
    );
  }
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new Error(
      `compileBufferTapOscSynthDef: chunkSize must be a positive integer, got ${chunkSize}`,
    );
  }
  const name = bufferTapOscSynthDefName(channels, chunkSize);
  const cached = cache.get(name);
  if (cached) return cached;

  const def = synthdef(name, (g, { inBus = 0, bufnum = 0, clockBus = 0 }) => {
    // In.ar(bus, channels) — fan to per-channel UGenInputs the
    // same way bufferTapSynthDef does, so BufWr writes all
    // channels interleaved.
    const inUgen = g.In.ar(inBus, channels);
    const inIdx = ugenIndex(inUgen);
    if (inIdx === null) {
      throw new Error(
        'compileBufferTapOscSynthDef: In.ar did not return a UGen ref',
      );
    }
    const sigs: UGenInput[] = [];
    for (let c = 0; c < channels; c++) {
      sigs.push(uo(inIdx, c));
    }

    // Read clockBus's sample-counting Phasor; derive writeIdx
    // by wrapping at 2×chunkSize. The clockBus value is
    // monotonically advancing audio-rate sample count modulo
    // (2 × chunkSize) — see scripts/lib/clock.scd's
    // Phasor.ar(0, 1, 0, wrap) where wrap = 2/tickRate sample
    // periods. So `clockPhase % (2*chunkSize)` is exactly the
    // ring writeIdx aligned with global tick parity.
    const clockPhase = g.In.ar(clockBus, 1);
    const writeIdx = g.mod(clockPhase, chunkSize * 2);

    // BufWr.ar(input_array, bufnum, phasor, loop=1).
    // loop=1 is the default; the writeIdx already wraps so
    // the buffer is overwritten in-place every 2 ticks. The
    // bridge reads the just-completed half (the OTHER half
    // from where the writer is right now) so writes don't
    // race reads.
    g.BufWr.ar(sigs, bufnum, writeIdx);
  });

  const bytes = def.toBytes();
  cache.set(name, bytes);
  return bytes;
}
