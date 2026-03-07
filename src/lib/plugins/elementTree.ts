import {ELEMENTS} from "@/constants/sc-elements";
import {generateId} from "@/lib/utils/generateId";
import {UGen, type UGenInput, Rate} from "@/lib/ugen/ugen";
import {synthDef, type SynthDef} from "@/lib/ugen/synthdef";
import {control} from "@/lib/ugen/control";
import {ugenRegistry} from "@/lib/ugen/registry";
import {binOp, unaryOp, binaryOps, unaryOps} from "@/lib/ugen/operators";
import "@/lib/ugen/ugens"; // side-effect: populates registry

export type ScElementNode = {
  id: string;
  tagName: string;
  attributes: Record<string, string>;
  descendants: ScElementNode[];
}

export interface PluginTreeEntry {
  tree: ScElementNode[];
  state: Record<string, any>;
  html: string;
}

interface ParseContext {
  state: Record<string, any>;
  saved?: ScElementNode[];
  offset: number;
}

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'synthdef', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

interface UGenElementSpec {
  name: string;
  type: string;
  rate: string;
  inputs: Record<string, string>;
}

// ---------------------------------------------------------------------------
// SynthDef compilation helpers (moved from declarative.ts)
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

    for (const value of Object.values(spec.inputs)) {
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

function resolveInputValue(
  value: string,
  ugenMap: Map<string, UGen>,
  controlMap: Map<string, UGen>,
): UGenInput {
  const num = Number(value);
  if (!isNaN(num) && value.trim() !== '') return num;

  if (value.includes(':')) {
    const [refId, indexStr] = value.split(':');
    const ugen = ugenMap.get(refId);
    if (ugen) return ugen.output(parseInt(indexStr, 10));
    throw new Error(`Unknown UGen ref: "${refId}" in "${value}"`);
  }

  const ugen = ugenMap.get(value);
  if (ugen) return ugen;

  const ctrl = controlMap.get(value);
  if (ctrl) return ctrl;

  throw new Error(`Cannot resolve input "${value}" — not a number, UGen id, or param name`);
}

function buildSynthDefFromSpecs(
  name: string,
  params: Record<string, number>,
  specs: Map<string, UGenElementSpec>,
): SynthDef {
  return synthDef(name, () => {
    const controlMap = new Map<string, UGen>();
    for (const [paramName, defaultValue] of Object.entries(params)) {
      controlMap.set(paramName, control(paramName, defaultValue));
    }

    const sorted = topoSort(specs);
    const ugenMap = new Map<string, UGen>();

    for (const spec of sorted) {
      const entry = ugenRegistry.lookup(spec.type);
      if (!entry) throw new Error(`Unknown UGen type: "${spec.type}"`);

      const rate = parseRate(spec.rate);

      if (spec.type === 'BinaryOpUGen') {
        const op = spec.inputs['op'];
        if (!op) throw new Error(`BinaryOpUGen "${spec.name}" requires an "op" attribute`);
        if (!(op in binaryOps)) throw new Error(`Unknown binary operator: "${op}"`);
        const a = resolveInputValue(spec.inputs['a'], ugenMap, controlMap);
        const b = resolveInputValue(spec.inputs['b'], ugenMap, controlMap);
        const result = binOp(op, a, b);
        if (typeof result === 'number') {
          ugenMap.set(spec.name, new UGen('DC', rate, [result], 1));
        } else if (result instanceof UGen) {
          ugenMap.set(spec.name, result);
        } else {
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

      const resolvedInputs: UGenInput[] = [];

      for (const [defName, defValue] of entry.defaults) {
        let attrValue: string | undefined;
        for (const [attrKey, attrVal] of Object.entries(spec.inputs)) {
          if (matchParamName(attrKey, [[defName, defValue]]) !== undefined) {
            attrValue = attrVal;
            break;
          }
        }

        if (attrValue !== undefined) {
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

const tagNames = new Set<string>(Object.values(ELEMENTS));

const STORAGE_KEY = 'sc-plugin-trees';
const SYNTHDEF_STORAGE_KEY = 'sc-compiled-synthdefs';

export class ElementTreeParser {
  private store: Record<string, PluginTreeEntry> = {};
  private synthDefs: Record<string, number[]> = {};

  init(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.store = raw ? JSON.parse(raw) : {};
    } catch {
      this.store = {};
    }
    try {
      const raw = localStorage.getItem(SYNTHDEF_STORAGE_KEY);
      this.synthDefs = raw ? JSON.parse(raw) : {};
    } catch {
      this.synthDefs = {};
    }
  }

  getCompiledSynthDef(name: string): Uint8Array | undefined {
    const arr = this.synthDefs[name];
    return arr ? new Uint8Array(arr) : undefined;
  }

  parse(boxId: string, node: Element): PluginTreeEntry {
    const ctx: ParseContext = {
      state: {},
      offset: 0,
      saved: this.store[boxId]?.tree,
    };
    const tree = this.buildTree(node, ctx);
    const html = node.innerHTML;
    const entry: PluginTreeEntry = { tree, state: ctx.state, html };
    this.store[boxId] = entry;
    this.persist();
    return entry;
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    localStorage.setItem(SYNTHDEF_STORAGE_KEY, JSON.stringify(this.synthDefs));
  }

  private buildTree(node: Element, ctx: ParseContext): ScElementNode[] {
    const result: ScElementNode[] = [];
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (!tagNames.has(tag)) {
        result.push(...this.buildTree(child, ctx));
        continue;
      }
      result.push(this.processElement(child, tag, ctx));
    }
    if (ctx.saved && ctx.offset < ctx.saved.length) {
      console.warn(`[plugin hydration] ${ctx.saved.length - ctx.offset} saved node(s) no longer present`);
    }
    return result;
  }

  private processElement(el: Element, tag: string, ctx: ParseContext): ScElementNode {
    const prev = ctx.saved?.[ctx.offset];
    const rehydrated = prev?.tagName === tag;
    if (prev && !rehydrated) {
      console.warn(`[plugin hydration] mismatch at index ${ctx.offset}: <${tag}> vs saved <${prev.tagName}>`);
    }
    ctx.offset++;

    const existingId = el.getAttribute('id');
    const id = existingId || (rehydrated ? prev.id : generateId());
    if (!existingId) {
      el.setAttribute('id', id)
    }
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attributes[attr.name] = attr.value;
    }

    const current: ScElementNode = { id, tagName: tag, attributes, descendants: [] };
    const childState = this.handleElement(current, ctx.state);
    current.descendants = this.buildTree(el, {
      state: childState,
      saved: rehydrated ? prev.descendants : undefined,
      offset: 0,
    });
    this.handlePostBuild(current);
    return current;
  }

  private handleElement(current: ScElementNode, state: Record<string, any>): Record<string, any> {
    switch (current.tagName) {
      case ELEMENTS.SC_GROUP:
        return this.handleGroup(current, state);
      case ELEMENTS.SC_SYNTH:
        return this.handleSynth(current, state);
      default: return state;
    }
  }

  private handlePostBuild(current: ScElementNode): void {
    switch (current.tagName) {
      case ELEMENTS.SC_SYNTHDEF:
        this.compileSynthDef(current);
        break;
    }
  }

  private compileSynthDef(current: ScElementNode): void {
    const name = current.attributes.name;
    if (!name) {
      console.error('[ElementTreeParser] <sc-synthdef> requires a name attribute');
      return;
    }

    // Collect params from synthdef attributes
    const params: Record<string, number> = {};
    for (const [key, value] of Object.entries(current.attributes)) {
      if (SYNTHDEF_SKIP_ATTRS.has(key)) continue;
      const val = Number(value);
      if (!isNaN(val)) {
        params[key] = val;
      }
    }

    // Collect UGen specs from descendants
    const specs = new Map<string, UGenElementSpec>();
    this.collectUGenSpecs(current.descendants, specs);

    if (specs.size === 0) {
      console.warn(`[ElementTreeParser] <sc-synthdef name="${name}"> has no <sc-ugen> children`);
      return;
    }

    try {
      const def = buildSynthDefFromSpecs(name, params, specs);
      const bytes = def.toBytes();
      this.synthDefs[name] = Array.from(bytes);
    } catch (err) {
      console.error(`[ElementTreeParser] <sc-synthdef name="${name}"> compilation failed:`, err);
    }
  }

  private collectUGenSpecs(nodes: ScElementNode[], specs: Map<string, UGenElementSpec>): void {
    for (const node of nodes) {
      if (node.tagName === ELEMENTS.SC_UGEN) {
        const name = node.attributes.name;
        const type = node.attributes.type;
        const rate = node.attributes.rate ?? 'ar';
        if (name && type) {
          const inputs: Record<string, string> = {};
          for (const [key, value] of Object.entries(node.attributes)) {
            if (!UGEN_SKIP_ATTRS.has(key)) {
              inputs[key] = value;
            }
          }
          specs.set(name, { name, type, rate, inputs });
        }
      }
      this.collectUGenSpecs(node.descendants, specs);
    }
  }

  private handleGroup(current: ScElementNode, state: Record<string, any>): Record<string, any> {
    const name = current.attributes.name;
    if (!name) return state;
    const groupState: Record<string, any> = {};
    state[name] = groupState;
    return groupState;
  }

  private handleSynth(current: ScElementNode, state: Record<string, any>): Record<string, any> {
    const name = current.attributes.name;
    if (name) {
      const params: Record<string, number> = {};
      for (const [key, value] of Object.entries(current.attributes)) {
        if (SYNTH_SKIP_ATTRS.has(key)) continue;
        const val = Number(value);
        if (!isNaN(val)) {
          params[key] = val
        }
      }
      state[name] = params;
    }
    return state;
  }
}
