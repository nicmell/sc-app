import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode, UGenSpec} from "../../types/parsers";
import {compileSynthDef} from "./SynthDefCompiler";
import {findElementByPath} from "./elementTree";
import {isSynth, isGroup, isParent, isNode} from "./guards";
import {runtimeApi} from "@/lib/stores/api.ts";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);
const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children']);

interface WalkContext {
  saved?: ScElementNode;
  scope: ScElementNode[];
  offset: number;
}

interface ElementContext {
  el: Element;
  id: string;
}

type ElementHandler = (ectx: ElementContext, ctx: WalkContext) => ScElementNode;
type PropsExtractor = (el: Element) => Record<string, unknown>;

const handlers: Record<string, ElementHandler> = {
  [ELEMENTS.SC_GROUP]: (ectx, ctx) => processGroup(ectx, ctx),
  [ELEMENTS.SC_SYNTH]: (ectx, ctx) => processSynth(ectx, ctx),
  [ELEMENTS.SC_SYNTHDEF]: (ectx, ctx) => processSynthDef(ectx, ctx),
  [ELEMENTS.SC_RANGE]: (ectx, ctx) => processRange(ectx, ctx),
  [ELEMENTS.SC_CHECKBOX]: (ectx, ctx) => processCheckbox(ectx, ctx),
  [ELEMENTS.SC_RUN]: (ectx, ctx) => processRun(ectx, ctx),
  [ELEMENTS.SC_DISPLAY]: (ectx, ctx) => processDisplay(ectx, ctx),
  [ELEMENTS.SC_IF]: (ectx, ctx) => processIf(ectx, ctx),
};

const propsExtractors: Record<string, PropsExtractor> = {
  [ELEMENTS.SC_GROUP]: (el) => ({
    name: el.getAttribute('name') ?? '',
    running: el.getAttribute('running') !== 'false',
  }),
  [ELEMENTS.SC_SYNTH]: (el) => ({
    name: el.getAttribute('name') ?? '',
    bind: el.getAttribute('bind') ?? undefined,
    controls: collectNumericAttrs(el, SYNTH_SKIP_ATTRS),
    running: el.getAttribute('running') !== 'false',
  }),
  [ELEMENTS.SC_SYNTHDEF]: (el) => ({
    name: el.getAttribute('name') ?? '',
    params: collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS),
    ugens: collectUGenSpecs(el),
  }),
  [ELEMENTS.SC_RANGE]: (el) => ({ bind: el.getAttribute('bind') ?? '' }),
  [ELEMENTS.SC_CHECKBOX]: (el) => ({ bind: el.getAttribute('bind') ?? '' }),
  [ELEMENTS.SC_RUN]: (el) => ({ bind: el.getAttribute('bind') ?? '' }),
  [ELEMENTS.SC_DISPLAY]: (el) => ({
    bind: el.getAttribute('bind') ?? '',
    format: el.getAttribute('format') ?? '',
  }),
  [ELEMENTS.SC_IF]: (el) => ({ bind: el.getAttribute('bind') ?? '' }),
};

export function parsePlugin(boxId: string, node: Element): ScElementNode[] {
  return walkChildren(node, { offset: 0, saved: runtimeApi.getById(boxId), scope: [] });
}

function matchSaved(node: Element, saved?: ScElementNode): ScElementNode | undefined {
  if (!saved) {
    return undefined
  }
  const tag = node.tagName.toLowerCase();
  const props = extractProps(tag, node);
  if (saved.type === tag && propsMatch(props, saved)) {
    return saved
  } else {
    console.warn(`[plugin hydration] mismatch: <${tag}> vs saved <${saved.type}>`);
  }
  return undefined;
}

function assignId(node: Element, matched?: ScElementNode): void {
  const id = matched ? matched.id : (node.getAttribute('id') || randomId());
  node.setAttribute('id', id);
}

function hydrate(node: Element, saved?: ScElementNode): void {
  const matched = matchSaved(node, saved);
  assignId(node, matched);
  if (matched && isParent(matched)) {
    hydrateChildren(node, matched);
  }
}

function hydrateChildren(node: Element, saved: ScElementNode, ctx = { offset: 0 }): void {
  if (!isParent(saved)) return;
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag in handlers) {
      ctx.offset++;
      hydrate(child, saved.children[ctx.offset]);
    } else {
      hydrateChildren(child, saved, ctx);
    }
  }
}

function propsMatch(fresh: Record<string, unknown>, saved: ScElementNode): boolean {
  const savedProps: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(saved)) {
    if (!EXCLUDE_KEYS.has(key)) savedProps[key] = val;
  }
  return deepEqual(fresh, savedProps);
}

function extractProps(tag: string, node: Element): Record<string, unknown> {
  const extractor = propsExtractors[tag];
  return { type: tag, ...extractor?.(node) };
}

function walkChildren(node: Element, ctx: WalkContext): ScElementNode[] {
  const result: ScElementNode[] = [];
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag in handlers) {
      result.push(processElement(child, tag, ctx));
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
  const saved = _ctx.saved && isParent(_ctx.saved) ? _ctx.saved.children[_ctx.offset - 1] : undefined;
  const running = el.getAttribute('running') !== 'false';
  const groupNode: ScGroupNode = { type: 'sc-group', id, name, running, children: [], runtime: { isRunning: running, controls: {} } };
  const children = walkChildren(el, { saved, offset: 0, scope: [..._ctx.scope, groupNode] });
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

  const prev = ctx.saved && isParent(ctx.saved) ? ctx.saved.children[ctx.offset - 1] : undefined;
  const savedDef = prev?.type === 'sc-synthdef' ? prev as ScSynthDefNode : undefined;

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

function processDisplay({ el, id }: ElementContext, ctx: WalkContext): ScDisplayNode {
  resolveBindValue(el, ctx);
  const bind = el.getAttribute('bind') ?? '';
  const format = el.getAttribute('format') ?? '';
  return { type: 'sc-display', id, bind, format };
}

function processIf({ el, id }: ElementContext, ctx: WalkContext): ScIfNode {
  resolveBindValue(el, ctx);
  const bind = el.getAttribute('bind') ?? '';
  const children = walkChildren(el, { saved: ctx.saved, offset: ctx.offset, scope: ctx.scope });
  return { type: 'sc-if', id, bind, children };
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
