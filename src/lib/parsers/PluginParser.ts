import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {get} from "@/lib/utils/get";
import type {ScElementNode, ScGroupNode, ScRangeNode, ScCheckboxNode, PluginTreeEntry} from "./types";
import {compileSynthDef} from "./SynthDefCompiler";
import {computeState} from "./elementTree";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'synthdef', 'class', 'style', 'slot', 'title']);
interface WalkContext {
  saved?: ScElementNode[];
  offset: number;
  scope: ScElementNode[];
}

interface ElementContext {
  el: Element;
  id: string;
  matched?: ScElementNode;
}

type ElementHandler = (ectx: ElementContext, ctx: WalkContext) => ScElementNode;

export class PluginParser {
  private readonly handlers: Record<string, ElementHandler> = {
    [ELEMENTS.SC_GROUP]: (ectx, ctx) => this.processGroup(ectx, ctx),
    [ELEMENTS.SC_SYNTH]: (ectx) => this.processSynth(ectx),
    [ELEMENTS.SC_SYNTHDEF]: (ectx) => this.processSynthDef(ectx),
    [ELEMENTS.SC_RANGE]: (ectx, ctx) => this.processRange(ectx, ctx),
    [ELEMENTS.SC_CHECKBOX]: (ectx, ctx) => this.processCheckbox(ectx, ctx),
  };

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

    const id = this.hydrateId(el, matched);
    const node = this.handlers[tag]({ el, id, matched }, ctx);
    ctx.scope.push(node);
    return node;
  }

  private processGroup({ el, id, matched }: ElementContext, _ctx: WalkContext): ScGroupNode {
    const name = el.getAttribute('name') ?? '';
    const groupSaved = matched as ScGroupNode | undefined;
    const children = this.walkChildren(el, { saved: groupSaved?.children, offset: 0, scope: [] });
    return { type: 'sc-group', id, name, children, isRunning: true };
  }

  private processSynth({ el, id }: ElementContext): ScElementNode {
    const name = el.getAttribute('name') ?? '';
    const synthdef = el.getAttribute('synthdef') ?? undefined;
    const controls = this.collectNumericAttrs(el);
    return { type: 'sc-synth', id, name, synthdef, controls, isRunning: true };
  }

  private processSynthDef({ el, id }: ElementContext): ScElementNode {
    const name = el.getAttribute('name') ?? '';
    const bytes = compileSynthDef(el);
    return { type: 'sc-synthdef', id, name, bytes };
  }

  private processRange({ el, id }: ElementContext, ctx: WalkContext): ScRangeNode {
    const bind = el.getAttribute('bind') ?? '';
    const state = computeState(ctx.scope);
    const value = (get(state, bind) as number) ?? 0;
    return { type: 'sc-range', id, bind, value };
  }

  private processCheckbox({ el, id }: ElementContext, ctx: WalkContext): ScCheckboxNode {
    const bind = el.getAttribute('bind') ?? '';
    const state = computeState(ctx.scope);
    const value = (get(state, bind) as number) ?? 0;
    return { type: 'sc-checkbox', id, bind, value };
  }

  private hydrateId(el: Element, saved?: ScElementNode): string {
    const existingId = el.getAttribute('id');
    const id = existingId || (saved ? saved.id : randomId());
    if (!existingId) el.setAttribute('id', id);
    return id;
  }

  private collectNumericAttrs(el: Element): Record<string, number> {
    const params: Record<string, number> = {};
    for (const attr of Array.from(el.attributes)) {
      if (SYNTH_SKIP_ATTRS.has(attr.name)) continue;
      const val = Number(attr.value);
      if (!isNaN(val)) params[attr.name] = val;
    }
    return params;
  }
}
