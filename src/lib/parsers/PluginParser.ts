import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScRangeNode, ScCheckboxNode, ScRunNode, ScMidiNode, UGenSpec, RuntimeEntry, PluginTreeEntry} from "./types";
import {compileSynthDef} from "./SynthDefCompiler";
import {findElementByPath} from "./elementTree";
import {isSynth, isGroup, isNode, isInput, isRun} from "./guards";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'is-running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

interface WalkContext {
  saved?: ScElementNode[];
  scope: ScElementNode[];
  offset: number;
  savedRuntime?: RuntimeEntry[];
  runtime: RuntimeEntry[];
}

interface ElementContext {
  el: Element;
  id: string;
}

type ElementHandler = (ectx: ElementContext, ctx: WalkContext) => ScElementNode;

export class PluginParser {
  private static readonly EXCLUDE_KEYS = new Set(['id', 'runtime', 'children', 'bytes']);

  private readonly handlers: Record<string, ElementHandler> = {
    [ELEMENTS.SC_GROUP]: (ectx, ctx) => this.processGroup(ectx, ctx),
    [ELEMENTS.SC_SYNTH]: (ectx, ctx) => this.processSynth(ectx, ctx),
    [ELEMENTS.SC_SYNTHDEF]: (ectx, ctx) => this.processSynthDef(ectx, ctx),
    [ELEMENTS.SC_RANGE]: (ectx, ctx) => this.processRange(ectx, ctx),
    [ELEMENTS.SC_CHECKBOX]: (ectx, ctx) => this.processCheckbox(ectx, ctx),
    [ELEMENTS.SC_RUN]: (ectx, ctx) => this.processRun(ectx, ctx),
    [ELEMENTS.SC_MIDI]: (ectx, ctx) => this.processMidi(ectx, ctx),
  };

  private static readonly BIND_ONLY_TAGS: Set<string> = new Set([ELEMENTS.SC_DISPLAY, ELEMENTS.SC_IF]);

  parse(node: Element, saved?: ScElementNode[], savedRuntime?: RuntimeEntry[]): PluginTreeEntry {
    const ctx: WalkContext = { offset: 0, saved, savedRuntime, scope: [], runtime: [] };
    const tree = this.walkChildren(node, ctx);
    const html = node.innerHTML;
    const title = node.querySelector('title')?.textContent ?? undefined;

    // Hydration: remap fresh entry IDs to saved IDs and restore saved values
    if (saved && savedRuntime) {
      this.hydrate(tree, saved, ctx.runtime, savedRuntime);
    }

    return { tree, runtime: ctx.runtime, html, title };
  }

  private walkChildren(node: Element, ctx: WalkContext): ScElementNode[] {
    const result: ScElementNode[] = [];
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag in this.handlers) {
        result.push(this.processElement(child, tag, ctx));
      } else if (PluginParser.BIND_ONLY_TAGS.has(tag)) {
        this.resolveBindEntry(child, ctx);
        result.push(...this.walkChildren(child, ctx));
      } else {
        result.push(...this.walkChildren(child, ctx));
      }
    }
    return result;
  }

  private processElement(el: Element, tag: string, ctx: WalkContext): ScElementNode {
    const prev = ctx.saved?.[ctx.offset];
    const matched = prev?.type === tag ? prev : undefined;
    if (prev && !matched) {
      console.warn(`[plugin hydration] mismatch at index ${ctx.offset}: <${tag}> vs saved <${prev.type}>`);
    }
    ctx.offset++;

    const id = el.getAttribute('id') || randomId();
    const node = this.handlers[tag]({ el, id }, ctx);

    if (matched && this.propsMatch(node, matched)) {
      node.id = matched.id;
    }

    el.setAttribute('id', node.id);
    ctx.scope.push(node);
    return node;
  }

  private propsMatch(fresh: ScElementNode, saved: ScElementNode): boolean {
    if (fresh.type !== saved.type) return false;
    const strip = (node: ScElementNode) => {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(node)) {
        if (!PluginParser.EXCLUDE_KEYS.has(key)) result[key] = val;
      }
      return result;
    };
    return deepEqual(strip(fresh), strip(saved));
  }

  private processGroup({ el, id }: ElementContext, _ctx: WalkContext): ScGroupNode {
    const name = el.getAttribute('name') ?? '';
    const groupSaved = _ctx.saved?.[_ctx.offset - 1] as ScGroupNode | undefined;
    const savedChildren = groupSaved?.type === 'sc-group' && groupSaved.name === name
      ? groupSaved.children
      : undefined;
    const isRunning = el.getAttribute('is-running') !== 'false';

    // Create run entry for the group
    const runEntryId = randomId();
    _ctx.runtime.push({ id: runEntryId, type: "run", targetNode: id, value: isRunning ? 1 : 0 });

    const groupNode: ScGroupNode = { type: 'sc-group', id, name, isRunning, children: [], runtime: { run: runEntryId, controls: {} } };
    const children = this.walkChildren(el, { saved: savedChildren, savedRuntime: _ctx.savedRuntime, offset: 0, scope: [..._ctx.scope, groupNode], runtime: _ctx.runtime });
    groupNode.children = children;
    return groupNode;
  }

  private processSynth({ el, id }: ElementContext, ctx: WalkContext): ScSynthNode {
    const name = el.getAttribute('name') ?? '';
    const bind = el.getAttribute('bind') ?? undefined;
    const controls = this.collectNumericAttrs(el, SYNTH_SKIP_ATTRS);
    if (bind && !ctx.scope.some(n => n.type === 'sc-synthdef' && n.name === bind)) {
      throw new Error(`<sc-synth name="${name}">: bind "${bind}" does not match any <sc-synthdef> in scope`);
    }
    const isRunning = el.getAttribute('is-running') !== 'false';

    // Create control entries for each control
    const controlEntries: Record<string, string> = {};
    for (const [controlName, defaultValue] of Object.entries(controls)) {
      const entryId = randomId();
      ctx.runtime.push({ id: entryId, type: "control", targetNode: id, value: defaultValue });
      controlEntries[controlName] = entryId;
    }

    // Create run entry
    const runEntryId = randomId();
    ctx.runtime.push({ id: runEntryId, type: "run", targetNode: id, value: isRunning ? 1 : 0 });

    return { type: 'sc-synth', id, name, bind, controls, isRunning, runtime: { run: runEntryId, controls: controlEntries } };
  }

  private processSynthDef({ el, id }: ElementContext, ctx: WalkContext): ScSynthDefNode {
    const name = el.getAttribute('name') ?? '';
    const params = this.collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS);
    const ugens = this.collectUGenSpecs(el);

    const saved = ctx.saved?.[ctx.offset - 1];
    const savedDef = saved?.type === 'sc-synthdef' ? saved as ScSynthDefNode : undefined;

    let bytes: number[];
    if (savedDef && deepEqual(params, savedDef.params) && deepEqual(ugens, savedDef.ugens)) {
      bytes = savedDef.bytes;
    } else {
      const specsMap = new Map<string, UGenSpec>();
      for (const spec of ugens) specsMap.set(spec.name, spec);
      bytes = compileSynthDef(name, params, specsMap);
    }

    return { type: 'sc-synthdef', id, name, params, ugens, bytes };
  }

  private processRange({ el, id }: ElementContext, ctx: WalkContext): ScRangeNode {
    const { bind, value, entryId } = this.resolveBindEntry(el, ctx);
    return { type: 'sc-range', id, bind, value, runtime: { value: entryId } };
  }

  private processCheckbox({ el, id }: ElementContext, ctx: WalkContext): ScCheckboxNode {
    const { bind, value, entryId } = this.resolveBindEntry(el, ctx);
    return { type: 'sc-checkbox', id, bind, value, runtime: { value: entryId } };
  }

  private processRun({ el, id }: ElementContext, ctx: WalkContext): ScRunNode {
    const bind = el.getAttribute('bind') ?? '';
    let runEntryId: string;
    if (bind) {
      const target = ctx.scope.find(n => 'name' in n && n.name === bind);
      if (!target || !isNode(target)) {
        throw new Error(`<sc-run>: bind "${bind}" does not reference a valid sc-synth or sc-group`);
      }
      runEntryId = target.runtime.run;
    } else {
      // Find parent node in scope (last node walking backwards)
      const parent = [...ctx.scope].reverse().find(n => isNode(n));
      if (parent && isNode(parent)) {
        runEntryId = parent.runtime.run;
      } else {
        // Fallback: create a standalone run entry
        runEntryId = randomId();
        ctx.runtime.push({ id: runEntryId, type: "run", targetNode: id, value: 1 });
      }
    }
    return { type: 'sc-run', id, bind, value: 1, runtime: { value: runEntryId } };
  }

  private processMidi({ el, id }: ElementContext, ctx: WalkContext): ScMidiNode {
    const { bind, value, entryId } = this.resolveBindEntry(el, ctx);
    const octaves = Number(el.getAttribute('octaves')) || 2;
    const octave = Number(el.getAttribute('octave')) || 4;
    return { type: 'sc-midi', id, bind, value, octaves, octave, runtime: { value: entryId } };
  }

  private resolveBindEntry(el: Element, ctx: WalkContext): { bind: string; value: number; entryId: string } {
    const bind = el.getAttribute('bind') ?? '';
    if (!bind) return { bind, value: 0, entryId: '' };
    const segments = bind.split('.');
    const control = segments.pop()!;
    const target = findElementByPath(ctx.scope, segments);
    if (!target) {
      throw new Error(`<${el.tagName.toLowerCase()}>: bind path "${bind}" does not resolve`);
    }
    if (isSynth(target)) {
      if (!(control in target.controls)) {
        throw new Error(`<${el.tagName.toLowerCase()}>: bind path "${bind}" does not resolve`);
      }
      const entryId = target.runtime.controls[control];
      const entry = ctx.runtime.find(e => e.id === entryId);
      return { bind, value: entry?.value ?? target.controls[control], entryId };
    }
    if (isGroup(target)) {
      // Check if group already has an entry for this control
      const existingEntryId = target.runtime.controls[control];
      if (existingEntryId) {
        const entry = ctx.runtime.find(e => e.id === existingEntryId);
        return { bind, value: entry?.value ?? 0, entryId: existingEntryId };
      }
      // Find a synth in scope that has this control to get default value
      const synth = ctx.scope.find(n => isSynth(n) && control in n.controls);
      if (!synth || !isSynth(synth)) {
        throw new Error(`<${el.tagName.toLowerCase()}>: no synth in scope has control "${control}"`);
      }
      // Create group control entry on demand
      const entryId = randomId();
      const value = synth.controls[control];
      ctx.runtime.push({ id: entryId, type: "control", targetNode: target.id, value });
      target.runtime.controls[control] = entryId;
      return { bind, value, entryId };
    }
    throw new Error(`<${el.tagName.toLowerCase()}>: bind path "${bind}" does not resolve`);
  }

  private hydrate(freshTree: ScElementNode[], savedTree: ScElementNode[], freshRuntime: RuntimeEntry[], savedRuntime: RuntimeEntry[]): void {
    // Build mapping: fresh entry ID → saved entry ID + saved value
    const idMap = new Map<string, { savedId: string; savedValue: number }>();
    this.buildIdMap(freshTree, savedTree, idMap, savedRuntime);

    // Apply mapping to runtime entries
    for (const entry of freshRuntime) {
      const mapping = idMap.get(entry.id);
      if (mapping) {
        entry.id = mapping.savedId;
        entry.value = mapping.savedValue;
      }
    }

    // Apply mapping to tree node runtime references
    this.remapTreeIds(freshTree, idMap);
  }

  private buildIdMap(
    fresh: ScElementNode[],
    saved: ScElementNode[],
    idMap: Map<string, { savedId: string; savedValue: number }>,
    savedRuntime: RuntimeEntry[],
  ): void {
    // Walk flat (saved was stored with stripRuntime, but we rebuilt runtime refs)
    // We match by position within the tree and same id (from processElement hydration)
    const savedById = new Map<string, ScElementNode>();
    this.collectById(saved, savedById);

    this.walkForMapping(fresh, savedById, idMap, savedRuntime);
  }

  private collectById(elements: ScElementNode[], map: Map<string, ScElementNode>): void {
    for (const el of elements) {
      map.set(el.id, el);
      if (isGroup(el)) this.collectById(el.children, map);
    }
  }

  private walkForMapping(
    elements: ScElementNode[],
    savedById: Map<string, ScElementNode>,
    idMap: Map<string, { savedId: string; savedValue: number }>,
    savedRuntime: RuntimeEntry[],
  ): void {
    for (const el of elements) {
      const savedEl = savedById.get(el.id);
      if (savedEl && savedEl.type === el.type && isNode(el) && isNode(savedEl)) {
        // Map run entry
        if (el.runtime.run && savedEl.runtime.run) {
          const savedEntry = savedRuntime.find(e => e.id === savedEl.runtime.run);
          if (savedEntry) {
            idMap.set(el.runtime.run, { savedId: savedEl.runtime.run, savedValue: savedEntry.value });
          }
        }
        // Map control entries
        for (const [name, freshEntryId] of Object.entries(el.runtime.controls)) {
          const savedEntryId = savedEl.runtime.controls[name];
          if (savedEntryId) {
            const savedEntry = savedRuntime.find(e => e.id === savedEntryId);
            if (savedEntry) {
              idMap.set(freshEntryId, { savedId: savedEntryId, savedValue: savedEntry.value });
            }
          }
        }
      }
      if (isGroup(el)) {
        this.walkForMapping(el.children, savedById, idMap, savedRuntime);
      }
    }
  }

  private remapTreeIds(elements: ScElementNode[], idMap: Map<string, { savedId: string; savedValue: number }>): void {
    for (const el of elements) {
      if (isNode(el)) {
        const runMapping = idMap.get(el.runtime.run);
        if (runMapping) el.runtime.run = runMapping.savedId;
        for (const name of Object.keys(el.runtime.controls)) {
          const mapping = idMap.get(el.runtime.controls[name]);
          if (mapping) el.runtime.controls[name] = mapping.savedId;
        }
      }
      if ((isInput(el) || isRun(el)) && el.runtime.value) {
        const mapping = idMap.get(el.runtime.value);
        if (mapping) el.runtime.value = mapping.savedId;
      }
      if (isGroup(el)) {
        this.remapTreeIds(el.children, idMap);
      }
    }
  }

  private collectUGenSpecs(el: Element): UGenSpec[] {
    const specs: UGenSpec[] = [];

    function walk(node: Element): void {
      for (const child of Array.from(node.children)) {
        if (child.tagName.toLowerCase() === ELEMENTS.SC_UGEN) {
          const name = child.getAttribute('name');
          const type = child.getAttribute('type');
          if (name && type) {
            const rate = child.getAttribute('rate') ?? 'ar';
            const inputs: Record<string, string> = {};
            for (const attr of Array.from(child.attributes)) {
              if (!UGEN_SKIP_ATTRS.has(attr.name)) inputs[attr.name] = attr.value;
            }
            specs.push({ name, type, rate, inputs });
          }
        }
        walk(child);
      }
    }

    walk(el);
    return specs;
  }

  private collectNumericAttrs(el: Element, skip: Set<string>): Record<string, number> {
    const params: Record<string, number> = {};
    for (const attr of Array.from(el.attributes)) {
      if (skip.has(attr.name)) continue;
      const val = Number(attr.value);
      if (!isNaN(val)) params[attr.name] = val;
    }
    return params;
  }
}
