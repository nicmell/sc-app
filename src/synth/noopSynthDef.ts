/**
 * Trivial SynthDef — `Out.ar(0, DC.ar(0))`. Loads and frees cleanly,
 * produces silence on audio bus 0. Exists only to exercise the
 * `/d_recv` path end-to-end.
 *
 * Compiled once at first call, cached for subsequent uses.
 */

import { synthdef } from '@sc-app/synthdef-compiler';

let cached: Uint8Array | null = null;

export function compileNoopSynthDef(): Uint8Array {
  if (cached) return cached;
  const def = synthdef('noop', (g) => {
    g.Out.ar(0, g.DC.ar(0));
  });
  cached = def.toBytes();
  return cached;
}
