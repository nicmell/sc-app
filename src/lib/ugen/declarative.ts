import { UGen, type UGenInput, Rate } from './ugen';
import { synthDef, type SynthDef } from './synthdef';
import { control } from './control';
import { ugenRegistry } from './registry';
import { binOp, unaryOp, binaryOps, unaryOps } from './operators';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UGenElementSpec {
  name: string;
  type: string;
  rate: string;
  inputs: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RATE_MAP: Record<string, Rate> = {
  ar: Rate.Audio,
  kr: Rate.Control,
  ir: Rate.Scalar,
  audio: Rate.Audio,
  control: Rate.Control,
  scalar: Rate.Scalar,
};

function parseRate(s: string): Rate {
  const r = RATE_MAP[s.toLowerCase()];
  if (r === undefined) throw new Error(`Unknown rate: "${s}"`);
  return r;
}

/**
 * Case-insensitive match of an attribute name against a registry spec's
 * default parameter names. HTML lowercases all attributes, so `doneAction`
 * becomes `doneaction`. Returns the canonical parameter name.
 */
function matchParamName(
  attrName: string,
  defaults: [string, number | undefined][],
): string | undefined {
  const lower = attrName.toLowerCase();
  for (const [name] of defaults) {
    if (name.toLowerCase() === lower) return name;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

function topoSort(specs: Map<string, UGenElementSpec>): UGenElementSpec[] {
  const sorted: UGenElementSpec[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular dependency involving "${id}"`);
    visiting.add(id);

    const spec = specs.get(id);
    if (!spec) throw new Error(`Unknown UGen id: "${id}"`);

    // Visit dependencies (input values that reference other ugen ids)
    for (const value of Object.values(spec.inputs)) {
      // Could be "someId" or "someId:0" — extract the id part
      const refId = value.split(':')[0];
      if (specs.has(refId)) {
        visit(refId);
      }
    }

    visiting.delete(id);
    visited.add(id);
    sorted.push(spec);
  }

  for (const id of specs.keys()) {
    visit(id);
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Input resolution
// ---------------------------------------------------------------------------

function resolveInputValue(
  value: string,
  ugenMap: Map<string, UGen>,
  controlMap: Map<string, UGen>,
): UGenInput {
  // 1. Try parse as number
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;

  // 2. UGen output ref "id:N"
  if (value.includes(':')) {
    const [refId, indexStr] = value.split(':');
    const ugen = ugenMap.get(refId);
    if (ugen) return ugen.output(parseInt(indexStr, 10));
    throw new Error(`Unknown UGen ref: "${refId}" in "${value}"`);
  }

  // 3. UGen ref (output 0)
  const ugen = ugenMap.get(value);
  if (ugen) return ugen;

  // 4. Control param ref
  const ctrl = controlMap.get(value);
  if (ctrl) return ctrl;

  throw new Error(`Cannot resolve input "${value}" — not a number, UGen id, or param name`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a SynthDef from declarative specs collected from `<sc-ugen>` elements.
 *
 * @param name   SynthDef name (from `<sc-synthdef name="...">`)
 * @param params Named parameters with default values (from sc-synthdef attributes)
 * @param specs  UGen element specs collected from children
 */
export function buildSynthDefFromSpecs(
  name: string,
  params: Record<string, number>,
  specs: Map<string, UGenElementSpec>,
): SynthDef {
  return synthDef(name, () => {
    // 1. Create controls for each param
    const controlMap = new Map<string, UGen>();
    for (const [paramName, defaultValue] of Object.entries(params)) {
      controlMap.set(paramName, control(paramName, defaultValue));
    }

    // 2. Topological sort
    const sorted = topoSort(specs);

    // 3. Build UGens in order
    const ugenMap = new Map<string, UGen>();

    for (const spec of sorted) {
      const entry = ugenRegistry.lookup(spec.type);
      if (!entry) throw new Error(`Unknown UGen type: "${spec.type}"`);

      const rate = parseRate(spec.rate);

      // Special handling for BinaryOpUGen / UnaryOpUGen
      if (spec.type === 'BinaryOpUGen') {
        const op = spec.inputs['op'];
        if (!op) throw new Error(`BinaryOpUGen "${spec.name}" requires an "op" attribute`);
        if (!(op in binaryOps)) throw new Error(`Unknown binary operator: "${op}"`);
        const a = resolveInputValue(spec.inputs['a'], ugenMap, controlMap);
        const b = resolveInputValue(spec.inputs['b'], ugenMap, controlMap);
        const result = binOp(op, a, b);
        // binOp may return a number (constant folding) — wrap in DC if needed
        if (typeof result === 'number') {
          ugenMap.set(spec.name, new UGen('DC', rate, [result], 1));
        } else if (result instanceof UGen) {
          ugenMap.set(spec.name, result);
        } else {
          // UGenOutput — get source
          ugenMap.set(spec.name, result.source);
        }
        continue;
      }

      if (spec.type === 'UnaryOpUGen') {
        const op = spec.inputs['op'];
        if (!op) throw new Error(`UnaryOpUGen "${spec.name}" requires an "op" attribute`);
        if (!(op in unaryOps)) throw new Error(`Unknown unary operator: "${op}"`);
        const a = resolveInputValue(spec.inputs['a'], ugenMap, controlMap);
        const result = unaryOp(op, a);
        if (typeof result === 'number') {
          ugenMap.set(spec.name, new UGen('DC', rate, [result], 1));
        } else if (result instanceof UGen) {
          ugenMap.set(spec.name, result);
        } else {
          ugenMap.set(spec.name, result.source);
        }
        continue;
      }

      // General UGen: resolve inputs in spec order
      // For Out-family UGens, "channelsArray" input may reference another UGen
      const resolvedInputs: UGenInput[] = [];

      for (const [defName, defValue] of entry.defaults) {
        // Find the matching attribute (case-insensitive)
        let attrValue: string | undefined;
        for (const [attrKey, attrVal] of Object.entries(spec.inputs)) {
          if (matchParamName(attrKey, [[defName, defValue]]) !== undefined) {
            attrValue = attrVal;
            break;
          }
        }

        if (attrValue !== undefined) {
          // For Out/ReplaceOut/OffsetOut "channelsArray" — may be a comma-separated list of refs
          if (defName === 'channelsArray') {
            const refs = attrValue.split(',').map(s => s.trim());
            for (const ref of refs) {
              resolvedInputs.push(resolveInputValue(ref, ugenMap, controlMap));
            }
          } else {
            resolvedInputs.push(resolveInputValue(attrValue, ugenMap, controlMap));
          }
        } else if (defValue !== undefined) {
          resolvedInputs.push(defValue);
        } else {
          throw new Error(
            `UGen "${spec.name}" (${spec.type}): missing required input "${defName}"`,
          );
        }
      }

      const numOutputs = entry.numOutputs ?? 1;
      const ugen = new UGen(spec.type, rate, resolvedInputs, numOutputs);
      ugenMap.set(spec.name, ugen);
    }
  });
}
