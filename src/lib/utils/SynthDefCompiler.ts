import {UGen, type UGenInput, Rate} from "@/lib/ugen/ugen";
import {synthDef} from "@/lib/ugen/synthdef";
import {control} from "@/lib/ugen/control";
import {ugenRegistry, type UGenRegistryEntry} from "@/lib/ugen/registry";
import {binOp, unaryOp, binaryOps, unaryOps} from "@/lib/ugen/operators";
import "@/lib/ugen/ugens"; // side-effect: populates registry
import type {UGenSpec} from "../../types/parsers";

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

      switch (spec.type) {
        case 'BinaryOpUGen': this.buildBinaryOp(spec, rate); break;
        case 'UnaryOpUGen':  this.buildUnaryOp(spec, rate); break;
        default:             this.buildStandardUGen(spec, entry, rate);
      }
    }
  }

  private buildBinaryOp(spec: UGenSpec, rate: Rate): void {
    const op = this.requireInput(spec, 'op');
    if (!(op in binaryOps)) throw new Error(`Unknown binary operator: "${op}"`);
    const a = this.resolveInput(spec.inputs['a']);
    const b = this.resolveInput(spec.inputs['b']);
    this.storeOpResult(spec.name, binOp(op, a, b), rate);
  }

  private buildUnaryOp(spec: UGenSpec, rate: Rate): void {
    const op = this.requireInput(spec, 'op');
    if (!(op in unaryOps)) throw new Error(`Unknown unary operator: "${op}"`);
    const a = this.resolveInput(spec.inputs['a']);
    this.storeOpResult(spec.name, unaryOp(op, a), rate);
  }

  private buildStandardUGen(spec: UGenSpec, entry: UGenRegistryEntry, rate: Rate): void {
    const inputs = this.resolveStandardInputs(spec, entry.defaults);
    const numOutputs = entry.numOutputs ?? 1;
    this.ugenMap.set(spec.name, new UGen(spec.type, rate, inputs, numOutputs));
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
      if (key.toLowerCase() === lower) return value;
    }
    return undefined;
  }

  private requireInput(spec: UGenSpec, key: string): string {
    const value = spec.inputs[key];
    if (!value) throw new Error(`${spec.type} "${spec.name}" requires an "${key}" attribute`);
    return value;
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

  private storeOpResult(name: string, result: UGenInput, rate: Rate): void {
    if (typeof result === 'number') {
      this.ugenMap.set(name, new UGen('DC', rate, [result], 1));
    } else if (result instanceof UGen) {
      this.ugenMap.set(name, result);
    } else {
      this.ugenMap.set(name, result.source);
    }
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
