import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScRangeNode, ScCheckboxNode, ScRunNode, ScMidiNode, UGenSpec, PluginTreeEntry} from "../../types/parsers";
import {compileSynthDef} from "./SynthDefCompiler";
import {findElementByPath} from "./elementTree";
import {isSynth, isGroup, isNode} from "./guards";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'is-running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

interface WalkContext {
  saved?: ScElementNode[];
  scope: ScElementNode[];
  offset: number;
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

  parse(node: Element, saved?: ScElementNode[]): PluginTreeEntry {
    const ctx: WalkContext = { offset: 0, saved, scope: [] };
    const tree = this.walkChildren(node, ctx);
    const html = node.innerHTML;
    const title = node.querySelector('title')?.textContent ?? undefined;
    return { tree, html, title };
  }

  private walkChildren(node: Element, ctx: WalkContext): ScElementNode[] {
    const result: ScElementNode[] = [];
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag in this.handlers) {
        result.push(this.processElement(child, tag, ctx));
      } else if (PluginParser.BIND_ONLY_TAGS.has(tag)) {
        this.resolveBindValue(child, ctx);
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
    const groupNode: ScGroupNode = { type: 'sc-group', id, name, isRunning, children: [], runtime: { isRunning, controls: {} } };
    const children = this.walkChildren(el, { saved: savedChildren, offset: 0, scope: [..._ctx.scope, groupNode] });
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
    return { type: 'sc-synth', id, name, bind, controls, isRunning, runtime: { isRunning, controls: {...controls} } };
  }

  private processSynthDef({ el, id }: ElementContext, ctx: WalkContext): ScSynthDefNode {
    const name = el.getAttribute('name') ?? '';
    const params = this.collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS);
    const ugens = this.collectUGenSpecs(el);

    const saved = ctx.saved?.[ctx.offset - 1];
    const savedDef = saved?.type === 'sc-synthdef' ? saved as ScSynthDefNode : undefined;

    let bytes: number[];
    if (savedDef && deepEqual(params, savedDef.params) && deepEqual(ugens, savedDef.ugens)) {
      bytes = savedDef.runtime.value;
    } else {
      const specsMap = new Map<string, UGenSpec>();
      for (const spec of ugens) specsMap.set(spec.name, spec);
      bytes = compileSynthDef(name, params, specsMap);
    }

    return { type: 'sc-synthdef', id, name, params, ugens, runtime: { value: bytes } };
  }

  private processRange({ el, id }: ElementContext, ctx: WalkContext): ScRangeNode {
    const { bind, value } = this.resolveBindValue(el, ctx);
    return { type: 'sc-range', id, bind, value, runtime: { value } };
  }

  private processCheckbox({ el, id }: ElementContext, ctx: WalkContext): ScCheckboxNode {
    const { bind, value } = this.resolveBindValue(el, ctx);
    return { type: 'sc-checkbox', id, bind, value, runtime: { value } };
  }

  private processRun({ el, id }: ElementContext, ctx: WalkContext): ScRunNode {
    const bind = el.getAttribute('bind') ?? '';
    if (bind) {
      const target = ctx.scope.find(n => 'name' in n && n.name === bind);
      if (!target || !isNode(target)) {
        throw new Error(`<sc-run>: bind "${bind}" does not reference a valid sc-synth or sc-group`);
      }
    }
    return { type: 'sc-run', id, bind, value: 1, runtime: { value: 1 } };
  }

  private processMidi({ el, id }: ElementContext, ctx: WalkContext): ScMidiNode {
    const { bind, value } = this.resolveBindValue(el, ctx);
    const octaves = Number(el.getAttribute('octaves')) || 2;
    const octave = Number(el.getAttribute('octave')) || 4;
    return { type: 'sc-midi', id, bind, value, octaves, octave, runtime: { value } };
  }

  private resolveBindValue(el: Element, ctx: WalkContext): { bind: string; value: number } {
    const bind = el.getAttribute('bind') ?? '';
    if (!bind) return { bind, value: 0 };
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
      return { bind, value: target.controls[control] };
    }
    if (isGroup(target)) {
      const synth = ctx.scope.find(n => isSynth(n) && control in n.controls);
      if (!synth || !isSynth(synth)) {
        throw new Error(`<${el.tagName.toLowerCase()}>: no synth in scope has control "${control}"`);
      }
      return { bind, value: synth.controls[control] };
    }
    throw new Error(`<${el.tagName.toLowerCase()}>: bind path "${bind}" does not resolve`);
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
