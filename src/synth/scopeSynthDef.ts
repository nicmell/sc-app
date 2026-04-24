/**
 * Scope tap — reads an audio bus and writes it into a ring buffer
 * indexed by the clock's shared sample phase.
 *
 * The scope owns `decimation` and `scopeChunkSize` (both baked at
 * compile time from `DEFAULT_PARAMS`); the clock is oblivious. Each
 * scope frame is written at
 *     writeIdx = (clockPhase / decimation) mod (scopeChunkSize × 2)
 * which for the default 48000/48/250/4 config gives an integer
 * index stepping +1 every 4 audio samples and wrapping at 500.
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
 * Phase 7 only compiles the mono (channels = 1) form. Multi-channel
 * is deferred to Phase 10.
 */

import { synthdef } from '@sc-app/synthdef-compiler';
import { DEFAULT_PARAMS } from '@/config/clockConfig';

export const SCOPE_SYNTHDEF_NAME = 'scopeTap1';

let cached: Uint8Array | null = null;

export function compileScopeSynthDef(): Uint8Array {
  if (cached) return cached;

  const decimation = DEFAULT_PARAMS.decimation;
  const ring = DEFAULT_PARAMS.scopeChunkSize * 2;

  const def = synthdef(
    SCOPE_SYNTHDEF_NAME,
    (g, { inBus = 0, bufnum = 0, clockBus = 0 }) => {
      const sig = g.In.ar(inBus, 1);
      const phase = g.In.ar(clockBus, 1);
      const writeIdx = g.mod(g.div(phase, decimation), ring);
      g.BufWr.ar([sig], bufnum, writeIdx);
    },
  );

  cached = def.toBytes();
  return cached;
}
