import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import type {ScElementNode, ScGroupNode, PluginTreeEntry} from "./types";
import {compileSynthDef} from "./SynthDefCompiler";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'synthdef', 'class', 'style', 'slot', 'title']);
interface WalkContext {
  saved?: ScElementNode[];
  offset: number;
}

interface ElementContext {
  el: Element;
  id: string;
  matched?: ScElementNode;
}

type ElementHandler = (ectx: ElementContext) => ScElementNode;

export class PluginParser {
  private readonly handlers: Record<string, ElementHandler> = {
    [ELEMENTS.SC_GROUP]: (ectx) => this.processGroup(ectx),
    [ELEMENTS.SC_SYNTH]: (ectx) => this.processSynth(ectx),
    [ELEMENTS.SC_SYNTHDEF]: (ectx) => this.processSynthDef(ectx),
  };

  parse(node: Element, saved?: ScElementNode[]): PluginTreeEntry {
    const ctx: WalkContext = { offset: 0, saved };
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
    return this.handlers[tag]({ el, id, matched });
  }

  private processGroup({ el, id, matched }: ElementContext): ScGroupNode {
    const name = el.getAttribute('name') ?? '';
    const groupSaved = matched as ScGroupNode | undefined;
    const children = this.walkChildren(el, { saved: groupSaved?.children, offset: 0 });
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
