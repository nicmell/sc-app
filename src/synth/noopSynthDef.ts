/**
 * Trivial SynthDef used for Phase 3 acceptance — `Out.ar(0, DC.ar(0))`.
 * Loads and frees cleanly, produces silence on audio bus 0. Exists
 * only to exercise the `/d_recv` path end-to-end.
 *
 * Compiled once via the wasm component's typed `ugens` interface;
 * result cached at module scope so subsequent calls are free.
 */

import { core, ugens } from '@wasm/scsynthdef-compiler';

let cached: Uint8Array | null = null;

export function compileNoopSynthDef(): Uint8Array {
  if (cached) return cached;
  const def = new core.SynthDef('noop');
  const dc = ugens.dc(def, 'audio', { tag: 'constant', val: 0 });
  ugens.out(def, 'audio', { tag: 'constant', val: 0 }, [dc]);
  cached = def.toBytes();
  return cached;
}
