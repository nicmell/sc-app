/**
 * Buffer tap — reads an audio bus and writes it into one of
 * scsynth's shared-memory scope buffers via `ScopeOut2`. The
 * single tap synth for every consumer kind: scopes, recorders,
 * future analyzers.
 *
 * Phase 31 rewrite. Pre-31 this synth used `BufWr.ar` to write
 * into a regular Buffer ring, indexed by the clock's shared
 * sample-phase bus; the worker fired `/b_getn` per tick to read
 * back. Phase 31 retired that path entirely — `ScopeOut2` writes
 * directly into scsynth's Boost.Interprocess shared memory and
 * the bridge mmaps the segment to read slots in-process. No
 * `/b_getn`, no `/b_setn`, no buffer ring, no clockBus reading
 * inside the tap.
 *
 * One scope_buffer slot = one chunk: we set
 * `maxFrames = scopeFrames = chunkSize`, so each
 * triple-buffer slot exactly holds one tick's worth of audio.
 * The bridge polls SHM on every observed `/clock/tick` and
 * extracts the most-recently-completed slot.
 *
 * Compiled per `(channels, chunkSize)` tuple: SC's
 * `In.ar(bus, channels)` and `ScopeOut2(sigs, …, maxFrames,
 * scopeFrames)` bake the channel count + frame count into the
 * SynthDef bytes. `scopeNum` stays a synth control so one
 * compiled SynthDef serves N taps with different scope buffer
 * indices.
 *
 * Group-order invariant unchanged from pre-31: producer synths
 * (anything writing to `inBus`) must be at-or-before this tap in
 * the parent group's child order. The natural UX flow ("add a
 * synth, then add a consumer on its bus", both AddToTail) keeps
 * this right; insertion order = runtime order.
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

  const def = synthdef(
    name,
    (g, { inBus = 0, scopeNum = 0 }) => {
      // `In.ar(bus, channels)` registers an N-output UGen, but the
      // sugar returns a single `UGenInput` pointing at output 0
      // only. Passing that directly to `ScopeOut2(sig)` would wire
      // up channel 0 and silently drop the rest, leaving every
      // other lane flat. Explicitly fan the In UGen's outputs into
      // an array of UGenInputs (one per output) so ScopeOut2
      // writes all channels interleaved into the scope_buffer slot.
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
      // ScopeOut2(inputArray, scopeNum, maxFrames, scopeFrames).
      // maxFrames = scopeFrames = chunkSize so each completed slot
      // = one tick of audio (= one chunk delivered to consumers).
      // We don't bind the output of ScopeOut2 to anything — its
      // side-effect (writing the SHM scope_buffer) is the work.
      //
      // **Critical: .ar, not .kr.** Audio-rate ScopeOut2 writes
      // every audio sample (each ar sample lands in the slot);
      // control-rate would write once per control block (64
      // samples) so a 1024-frame slot takes ~1.4 s to fill — push
      // rate drops from 47 Hz to ~0.7 Hz, which the user sees as
      // "scope unresponsive". For full-fidelity recording we
      // absolutely need every sample, so .ar is non-negotiable.
      g.ScopeOut2.ar(sigs, scopeNum, chunkSize, chunkSize);
    },
  );

  const bytes = def.toBytes();
  cache.set(name, bytes);
  return bytes;
}
