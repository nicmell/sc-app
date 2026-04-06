import {UGen, type UGenInput, Rate} from "@/lib/ugen/ugen";
import {synthDef} from "@/lib/ugen/synthdef";
import {control} from "@/lib/ugen/control";
import {ugenRegistry, type UGenRegistryEntry} from "@/lib/ugen/registry";
import {binaryOps, unaryOps} from "@/lib/ugen/operators";
import "@/lib/ugen/ugen-db"; // side-effect: populates registry
import type {UGenSpec} from "@/types/parsers";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const RATE_MAP: Record<string, Rate> = {
  ar: Rate.Audio, kr: Rate.Control, ir: Rate.Scalar,
  audio: Rate.Audio, control: Rate.Control, scalar: Rate.Scalar,
};

function parseRate(s: string): Rate {
  const r = RATE_MAP[s.toLowerCase()];
  if (r === undefined) throw new Error(`Unknown rate: "${s}"`);
  return r;
}

function topoSort(specs: Map<string, UGenSpec>): UGenSpec[] {
  const sorted: UGenSpec[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(id: string) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular dependency involving "${id}"`);
    visiting.add(id);

    const spec = specs.get(id);
    if (!spec) throw new Error(`Unknown UGen id: "${id}"`);

    for (const value of Object.values(spec.inputs)) {
      const refId = value.split(':')[0];
      if (specs.has(refId)) visit(refId);
    }

    visiting.delete(id);
    visited.add(id);
    sorted.push(spec);
  }

  for (const id of specs.keys()) visit(id);
  return sorted;
}

const OP_TABLES: Record<string, Record<string, number>> = {
  BinaryOpUGen: binaryOps,
  UnaryOpUGen: unaryOps,
};

// ---------------------------------------------------------------------------
// UGen graph builder — resolves specs into a UGen graph inside synthDef()
// ---------------------------------------------------------------------------

class UGenGraphBuilder {
  private ugenMap = new Map<string, UGen>();
  private controlMap = new Map<string, UGen>();

  constructor(params: Record<string, number>) {
    for (const [name, value] of Object.entries(params)) {
      this.controlMap.set(name, control(name, value));
    }
  }

  build(specs: Map<string, UGenSpec>): void {
    for (const spec of topoSort(specs)) {
      const entry = ugenRegistry.lookup(spec.type);
      if (!entry) throw new Error(`Unknown UGen type: "${spec.type}"`);
      const rate = parseRate(spec.rate);
      this.buildUGen(spec, entry, rate);
    }
  }

  private buildUGen(spec: UGenSpec, entry: UGenRegistryEntry, rate: Rate): void {
    const inputs = this.resolveStandardInputs(spec, entry.defaults);
    const numOutputs = entry.numOutputs ?? 1;
    const specialIndex = this.resolveSpecialIndex(spec);
    this.ugenMap.set(spec.name, new UGen(spec.type, rate, inputs, numOutputs, specialIndex));
  }

  private resolveSpecialIndex(spec: UGenSpec): number {
    const opTable = OP_TABLES[spec.type];
    if (!opTable) return 0;
    const op = spec.inputs['op'];
    if (!op) throw new Error(`${spec.type} "${spec.name}" requires an "op" attribute`);
    const idx = opTable[op];
    if (idx === undefined) throw new Error(`${spec.type} "${spec.name}": unknown operator "${op}"`);
    return idx;
  }

  private resolveStandardInputs(
    spec: UGenSpec,
    defaults: [string, number | undefined][],
  ): UGenInput[] {
    const result: UGenInput[] = [];
    for (const [defName, defValue] of defaults) {
      const attrValue = this.findMatchingInput(spec.inputs, defName);

      if (attrValue !== undefined) {
        if (defName === 'channelsArray') {
          for (const ref of attrValue.split(',').map(s => s.trim())) {
            result.push(this.resolveInput(ref));
          }
        } else {
          result.push(this.resolveInput(attrValue));
        }
      } else if (defValue !== undefined) {
        result.push(defValue);
      } else {
        throw new Error(`UGen "${spec.name}" (${spec.type}): missing required input "${defName}"`);
      }
    }
    return result;
  }

  private findMatchingInput(inputs: Record<string, string>, paramName: string): string | undefined {
    const lower = paramName.toLowerCase();
    for (const [key, value] of Object.entries(inputs)) {
      if (key === 'op') continue; // op is handled via specialIndex, not as an input
      if (key.toLowerCase() === lower) return value;
    }
    return undefined;
  }

  private resolveInput(value: string): UGenInput {
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;

    if (value.includes(':')) {
      const [refId, indexStr] = value.split(':');
      const ugen = this.ugenMap.get(refId);
      if (ugen) return ugen.output(parseInt(indexStr, 10));
      throw new Error(`Unknown UGen ref: "${refId}" in "${value}"`);
    }

    const ugen = this.ugenMap.get(value);
    if (ugen) return ugen;

    const ctrl = this.controlMap.get(value);
    if (ctrl) return ctrl;

    throw new Error(`Cannot resolve input "${value}" — not a number, UGen id, or param name`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function compileSynthDef(
  name: string,
  params: Record<string, number>,
  specs: Map<string, UGenSpec>,
): number[] {
  if (!name) {
    throw new Error('<sc-synthdef> requires a name attribute');
  }

  if (specs.size === 0) {
    throw new Error(`<sc-synthdef name="${name}"> has no <sc-ugen> children`);
  }

  const def = synthDef(name, () => new UGenGraphBuilder(params).build(specs));
  return Array.from(def.toBytes());
}
