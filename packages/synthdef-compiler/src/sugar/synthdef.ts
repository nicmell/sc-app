import { SynthDef } from '../synthdef.js';
import { UGenInput } from '../ugen-input.js';
import { resolveControls } from './controls.js';
import { makeGraph } from './graph.js';
import type { Graph } from './graph.types.js';
import { parseCallback } from './parse-fn.js';

/**
 * sclang-style callback form for constructing a `SynthDef`:
 *
 * ```ts
 * const def = synthdef('sine', (g, { freq = 440, amp = 0.5 }) => {
 *   const osc = g.SinOsc.ar(freq, 0);
 *   g.Out.ar(0, g.mul(osc, amp));
 * });
 * const bytes = def.toBytes();
 * ```
 *
 * ### Controls
 *
 * Each key in the second parameter's destructuring pattern becomes a
 * named control. Plain numeric defaults (`freq = 440`) are control-rate
 * (kr). Wrap in `ar(v)` or `ir(v)` to override the rate.
 *
 * Defaults are read via `fn.toString()` source parsing. Expressions must
 * be either literal numbers or calls to `ar()`, `kr()`, `ir()` — outer
 * references (imports, captured variables) are not resolvable from the
 * parser's evaluation scope and will throw at build time.
 *
 * ### Graph namespace
 *
 * The first callback argument (`g`) is a namespace of every bundled
 * UGen with positional `.ar()` / `.kr()` / `.ir()` methods, plus
 * arithmetic and math operator helpers (`g.mul`, `g.add`, `g.neg`, …).
 * Each UGen call returns a `UGenInput` that can be passed to any
 * subsequent UGen or operator.
 *
 * Returns the populated `SynthDef`; callers invoke `.toBytes()` /
 * `.toJson()` on it themselves.
 */
export function synthdef<TControls extends Record<string, UGenInput>>(
  name: string,
  fn: (g: Graph, controls: TControls) => void,
): SynthDef {
  const def = new SynthDef(name);
  const parsed = parseCallback(fn);
  const controlsOut: Record<string, UGenInput> = {};
  if (parsed.hasControlsParam) {
    const resolved = resolveControls(parsed.controls);
    for (const r of resolved) {
      controlsOut[r.name] = def.addControl(r.name, r.defaultValue, r.rate);
    }
  }
  const g = makeGraph(def);
  fn(g, controlsOut as TControls);
  return def;
}
