import { binaryOpIndex, unaryOpIndex } from '../operators.js';
import { Rate } from '../rate.js';
import { lookupUgen, UGenRegistryEntry, ugensByCategory } from '../registry.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';
import type { Graph, GraphOperators } from './graph.types.js';

/**
 * Variadic `Vec<UGenInput>` arg names — collected separately in `buildUgen`
 * and appended to the input list after all non-variadic args, matching
 * what the Rust typed builders emit at wire time.
 */
const VARIADIC_ARGS = new Set(['channelsArray', 'inputArray']);

/** Arg names that drive `num_outputs` instead of adding an input wire. */
const NUM_OUTPUTS_ARGS = new Set(['numChannels']);

/**
 * Build a ready-to-use graph namespace for the given SynthDef. Exposes
 * every bundled UGen as `g.Name.ar(...)` / `.kr(...)` / `.ir(...)` with
 * positional arguments matching the registry order, plus `g.mul`,
 * `g.add`, `g.sub`, `g.div`, `g.neg`, `g.abs` operator helpers.
 */
export function makeGraph(def: SynthDef): Graph {
  const g: Record<string, unknown> = {};
  for (const [, slice] of ugensByCategory()) {
    for (const entry of slice) {
      const methods: Record<string, (...args: UGenInputLike[]) => UGenInput> = {};
      for (const rate of entry.rates) {
        const method = rate === 'audio' ? 'ar' : rate === 'control' ? 'kr' : 'ir';
        methods[method] = (...args: UGenInputLike[]) =>
          buildUgen(def, entry, rate, args);
      }
      g[entry.name] = methods;
    }
  }
  Object.assign(g, makeOperators(def));
  return g as unknown as Graph;
}

// ─── UGen assembly ──────────────────────────────────────────────────────

function buildUgen(
  def: SynthDef,
  entry: UGenRegistryEntry,
  rate: Rate,
  args: UGenInputLike[],
): UGenInput {
  const nonVariadic: UGenInput[] = [];
  const variadic: UGenInput[] = [];
  let numOutputsOverride: number | null = null;

  for (let i = 0; i < entry.defaults.length; i++) {
    const argSpec = entry.defaults[i];
    const provided = args[i];
    if (NUM_OUTPUTS_ARGS.has(argSpec.name)) {
      if (provided !== undefined) {
        if (typeof provided !== 'number' || !Number.isInteger(provided) || provided < 1) {
          throw new Error(
            `${entry.name}.${rateMethodName(rate)}: argument "${argSpec.name}" ` +
              `must be a positive integer (number of output channels), got ${String(provided)}`,
          );
        }
        numOutputsOverride = provided;
      } else if (argSpec.default !== null) {
        numOutputsOverride = Math.trunc(argSpec.default);
      } else {
        throw new Error(
          `${entry.name}.${rateMethodName(rate)}: missing required argument ` +
            `"${argSpec.name}" (output channel count)`,
        );
      }
      continue;
    }
    if (VARIADIC_ARGS.has(argSpec.name)) {
      const items = normaliseVariadic(entry.name, rate, argSpec.name, provided);
      variadic.push(...items);
      continue;
    }
    if (provided !== undefined) {
      nonVariadic.push(toUGenInput(provided));
    } else if (argSpec.default !== null) {
      nonVariadic.push({ tag: 'constant', val: argSpec.default });
    } else {
      throw new Error(
        `${entry.name}.${rateMethodName(rate)}: missing required argument "${argSpec.name}"`,
      );
    }
  }

  const inputs = [...nonVariadic, ...variadic];
  const numOutputs =
    numOutputsOverride !== null ? numOutputsOverride : entry.numOutputs ?? 1;
  const idx = def.addUgen(entry.name, rate, inputs, numOutputs, 0);
  return { tag: 'ugen', val: idx };
}

function normaliseVariadic(
  className: string,
  rate: Rate,
  argName: string,
  provided: UGenInputLike | UGenInputLike[] | undefined,
): UGenInput[] {
  if (provided === undefined) return [];
  if (Array.isArray(provided)) {
    return provided.map((v) => toUGenInput(v));
  }
  // Accept a single UGenInputLike — matches sclang where a "list of
  // signals" can be a single signal in the one-channel case.
  if (typeof provided === 'number' || typeof provided === 'object') {
    return [toUGenInput(provided as UGenInputLike)];
  }
  throw new Error(
    `${className}.${rateMethodName(rate)}: argument "${argName}" must be a ` +
      `UGen input or an array of UGen inputs`,
  );
}

function rateMethodName(rate: Rate): string {
  return rate === 'audio' ? 'ar' : rate === 'control' ? 'kr' : 'ir';
}

// ─── Operator helpers ───────────────────────────────────────────────────

function makeOperators(def: SynthDef): GraphOperators {
  const rateOf = (input: UGenInput): Rate => {
    if (input.tag === 'constant') return 'scalar';
    const idx = input.tag === 'ugen' ? input.val : input.ugenIdx;
    return def.getNodeRate(idx);
  };

  const combinedRate = (...inputs: UGenInput[]): Rate => {
    // Highest rate wins: audio > control > scalar.
    let best: Rate = 'scalar';
    for (const i of inputs) {
      const r = rateOf(i);
      if (r === 'audio') return 'audio';
      if (r === 'control') best = 'control';
    }
    return best;
  };

  const binOp = (op: string): ((a: UGenInputLike, b: UGenInputLike) => UGenInput) => {
    const special = binaryOpIndex(op);
    if (special === null) throw new Error(`unknown binary operator: ${op}`);
    return (a, b) => {
      const ai = toUGenInput(a);
      const bi = toUGenInput(b);
      const rate = combinedRate(ai, bi);
      const idx = def.addUgen('BinaryOpUGen', rate, [ai, bi], 1, special);
      return { tag: 'ugen', val: idx };
    };
  };

  const unOp = (op: string): ((a: UGenInputLike) => UGenInput) => {
    const special = unaryOpIndex(op);
    if (special === null) throw new Error(`unknown unary operator: ${op}`);
    return (a) => {
      const ai = toUGenInput(a);
      const rate = combinedRate(ai);
      const idx = def.addUgen('UnaryOpUGen', rate, [ai], 1, special);
      return { tag: 'ugen', val: idx };
    };
  };

  return {
    mul: binOp('*'),
    add: binOp('+'),
    sub: binOp('-'),
    div: binOp('/'),
    mod: binOp('%'),
    pow: binOp('pow'),
    min: binOp('min'),
    max: binOp('max'),
    neg: unOp('neg'),
    abs: unOp('abs'),
    reciprocal: unOp('reciprocal'),
    midicps: unOp('midicps'),
    cpsmidi: unOp('cpsmidi'),
    ampdb: unOp('ampdb'),
    dbamp: unOp('dbamp'),
  };
}

// Hoist so the Graph-types module can reference the same arg sets without
// re-declaring.
export { VARIADIC_ARGS, NUM_OUTPUTS_ARGS };

// Keep `lookupUgen` exported through this file so callers that only import
// the sugar layer still have a registry handle.
export { lookupUgen };
