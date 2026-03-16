import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScRangeNode, ScCheckboxNode, ScRunNode, ScMidiNode, UGenSpec} from "../../types/parsers";
import {compileSynthDef} from "./SynthDefCompiler";
import {findElementByPath} from "./elementTree";
import {isSynth, isGroup, isParent, isNode} from "./guards";
import {runtimeApi} from "@/lib/stores/api.ts";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);
const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children']);
const BIND_ONLY_TAGS: Set<string> = new Set([ELEMENTS.SC_DISPLAY, ELEMENTS.SC_IF]);

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

const handlers: Record<string, ElementHandler> = {
  [ELEMENTS.SC_GROUP]: (ectx, ctx) => processGroup(ectx, ctx),
  [ELEMENTS.SC_SYNTH]: (ectx, ctx) => processSynth(ectx, ctx),
  [ELEMENTS.SC_SYNTHDEF]: (ectx, ctx) => processSynthDef(ectx, ctx),
  [ELEMENTS.SC_RANGE]: (ectx, ctx) => processRange(ectx, ctx),
  [ELEMENTS.SC_CHECKBOX]: (ectx, ctx) => processCheckbox(ectx, ctx),
  [ELEMENTS.SC_RUN]: (ectx, ctx) => processRun(ectx, ctx),
  [ELEMENTS.SC_MIDI]: (ectx, ctx) => processMidi(ectx, ctx),
};

export function parsePlugin(boxId: string, node: Element): ScElementNode[] {
  const saved = runtimeApi.getById(boxId);
  if (saved) {
    hydrateIds(node, saved);
  }
  return walkChildren(node, { offset: 0, saved: saved?.children, scope: [] });
}

function hydrateIds(node: Element, saved: ScElementNode): void {
  if (!isParent(saved)) return;
  let offset = 0;
  const walk = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      const tag = child.tagName.toLowerCase();
      if (tag in handlers) {
        const prev = saved.children[offset];
        const props = extractProps(child);
        const matched = prev?.type === tag && propsMatch(props, prev) ? prev : undefined;
        if (prev && !matched) {
          console.warn(`[plugin hydration] mismatch at index ${offset}: <${tag}> vs saved <${prev.type}>`);
        }
        const id = matched ? matched.id : (child.getAttribute('id') || randomId());
        child.setAttribute('id', id);
        offset++;
        if (tag === ELEMENTS.SC_GROUP && matched) {
          hydrateIds(child, matched);
        }
      } else {
        walk(child);
      }
    }
  };
  walk(node);
}

function propsMatch(fresh: Record<string, unknown>, saved: ScElementNode): boolean {
  const savedProps: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(saved)) {
    if (!EXCLUDE_KEYS.has(key)) savedProps[key] = val;
  }
  return deepEqual(fresh, savedProps);
}

function extractProps(node: Element): Record<string, unknown> {
  const tag = node.tagName.toLowerCase();
  const props: Record<string, unknown> = { type: tag };
  switch (tag) {
    case ELEMENTS.SC_GROUP:
      props.name = node.getAttribute('name') ?? '';
      props.running = node.getAttribute('running') !== 'false';
      break;
    case ELEMENTS.SC_SYNTH:
      props.name = node.getAttribute('name') ?? '';
      props.bind = node.getAttribute('bind') ?? undefined;
      props.controls = collectNumericAttrs(node, SYNTH_SKIP_ATTRS);
      props.running = node.getAttribute('running') !== 'false';
      break;
    case ELEMENTS.SC_SYNTHDEF:
      props.name = node.getAttribute('name') ?? '';
      props.params = collectNumericAttrs(node, SYNTHDEF_SKIP_ATTRS);
      props.ugens = collectUGenSpecs(node);
      break;
    case ELEMENTS.SC_RANGE:
    case ELEMENTS.SC_CHECKBOX:
      props.bind = node.getAttribute('bind') ?? '';
      break;
    case ELEMENTS.SC_RUN:
      props.bind = node.getAttribute('bind') ?? '';
      break;
    case ELEMENTS.SC_MIDI:
      props.bind = node.getAttribute('bind') ?? '';
      props.octaves = Number(node.getAttribute('octaves')) || 2;
      props.octave = Number(node.getAttribute('octave')) || 4;
      break;
  }
  return props;
}

function walkChildren(node: Element, ctx: WalkContext): ScElementNode[] {
  const result: ScElementNode[] = [];
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag in handlers) {
      result.push(processElement(child, tag, ctx));
    } else if (BIND_ONLY_TAGS.has(tag)) {
      resolveBindValue(child, ctx);
      result.push(...walkChildren(child, ctx));
    } else {
      result.push(...walkChildren(child, ctx));
    }
  }
  return result;
}

function processElement(el: Element, tag: string, ctx: WalkContext): ScElementNode {
  ctx.offset++;
  const id = el.getAttribute('id')!;
  const node = handlers[tag]({ el, id }, ctx);
  ctx.scope.push(node);
  return node;
}

function processGroup({ el, id }: ElementContext, _ctx: WalkContext): ScGroupNode {
  const name = el.getAttribute('name') ?? '';
  const groupSaved = _ctx.saved?.[_ctx.offset - 1] as ScGroupNode | undefined;
  const savedChildren = groupSaved?.type === 'sc-group' && groupSaved.name === name
    ? groupSaved.children
    : undefined;
  const running = el.getAttribute('running') !== 'false';
  const groupNode: ScGroupNode = { type: 'sc-group', id, name, running, children: [], runtime: { isRunning: running, controls: {} } };
  const children = walkChildren(el, { saved: savedChildren, offset: 0, scope: [..._ctx.scope, groupNode] });
  groupNode.children = children;
  return groupNode;
}

function processSynth({ el, id }: ElementContext, ctx: WalkContext): ScSynthNode {
  const name = el.getAttribute('name') ?? '';
  const bind = el.getAttribute('bind') ?? undefined;
  const controls = collectNumericAttrs(el, SYNTH_SKIP_ATTRS);
  if (bind && !ctx.scope.some(n => n.type === 'sc-synthdef' && n.name === bind)) {
    throw new Error(`<sc-synth name="${name}">: bind "${bind}" does not match any <sc-synthdef> in scope`);
  }
  const running = el.getAttribute('running') !== 'false';
  return { type: 'sc-synth', id, name, bind, controls, running, runtime: { isRunning: running, controls: {...controls} } };
}

function processSynthDef({ el, id }: ElementContext, ctx: WalkContext): ScSynthDefNode {
  const name = el.getAttribute('name') ?? '';
  const params = collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS);
  const ugens = collectUGenSpecs(el);

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

function processRange({ el, id }: ElementContext, ctx: WalkContext): ScRangeNode {
  const { bind, value } = resolveBindValue(el, ctx);
  return { type: 'sc-range', id, bind, runtime: { value } };
}

function processCheckbox({ el, id }: ElementContext, ctx: WalkContext): ScCheckboxNode {
  const { bind, value } = resolveBindValue(el, ctx);
  return { type: 'sc-checkbox', id, bind, runtime: { value } };
}

function processRun({ el, id }: ElementContext, ctx: WalkContext): ScRunNode {
  const bind = el.getAttribute('bind') ?? '';
  if (bind) {
    const target = ctx.scope.find(n => 'name' in n && n.name === bind);
    if (!target || !isNode(target)) {
      throw new Error(`<sc-run>: bind "${bind}" does not reference a valid sc-synth or sc-group`);
    }
  }
  return { type: 'sc-run', id, bind, runtime: { value: 1 } };
}

function processMidi({ el, id }: ElementContext, ctx: WalkContext): ScMidiNode {
  const { bind, value } = resolveBindValue(el, ctx);
  const octaves = Number(el.getAttribute('octaves')) || 2;
  const octave = Number(el.getAttribute('octave')) || 4;
  return { type: 'sc-midi', id, bind, octaves, octave, runtime: { value } };
}

function resolveBindValue(el: Element, ctx: WalkContext): { bind: string; value: number } {
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

function collectUGenSpecs(el: Element): UGenSpec[] {
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

function collectNumericAttrs(el: Element, skip: Set<string>): Record<string, number> {
  const params: Record<string, number> = {};
  for (const attr of Array.from(el.attributes)) {
    if (skip.has(attr.name)) continue;
    const val = Number(attr.value);
    if (!isNaN(val)) params[attr.name] = val;
  }
  return params;
}
