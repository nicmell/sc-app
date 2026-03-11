import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import type {ScElementNode, ScGroupNode, PluginTreeEntry} from "./types";
import {compileSynthDef} from "./SynthDefCompiler";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'synthdef', 'class', 'style', 'slot', 'title']);
const PARSED_TAGS: Set<string> = new Set([ELEMENTS.SC_GROUP, ELEMENTS.SC_SYNTH, ELEMENTS.SC_SYNTHDEF]);

interface WalkContext {
  state: Record<string, any>;
  saved?: ScElementNode[];
  offset: number;
}

export class PluginParser {
  parse(node: Element, saved?: ScElementNode[]): PluginTreeEntry {
    const ctx: WalkContext = { state: {}, offset: 0, saved };
    const tree = this.walkChildren(node, ctx);
    const html = node.innerHTML;
    const title = node.querySelector('title')?.textContent ?? undefined;
    return { tree, state: ctx.state, html, title };
  }

  private walkChildren(node: Element, ctx: WalkContext): ScElementNode[] {
    const result: ScElementNode[] = [];
    for (const child of Array.from(node.children)) {
      const tag = child.tagName.toLowerCase();
      if (PARSED_TAGS.has(tag)) {
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

    switch (tag) {
      case ELEMENTS.SC_GROUP: {
        const name = el.getAttribute('name') ?? '';
        let childState = ctx.state;
        if (name) {
          childState = {};
          ctx.state[name] = childState;
        }
        const groupSaved = matched as ScGroupNode | undefined;
        const children = this.walkChildren(el, {
          state: childState,
          saved: groupSaved?.children,
          offset: 0,
        });
        return { type: 'sc-group', id, name, children, isRunning: true };
      }
      case ELEMENTS.SC_SYNTH: {
        const name = el.getAttribute('name') ?? '';
        const synthdef = el.getAttribute('synthdef') ?? undefined;
        const controls = this.collectNumericAttrs(el);
        if (name) ctx.state[name] = controls;
        return { type: 'sc-synth', id, name, synthdef, controls, isRunning: true };
      }
      case ELEMENTS.SC_SYNTHDEF: {
        const name = el.getAttribute('name') ?? '';
        const bytes = compileSynthDef(el);
        return { type: 'sc-synthdef', id, name, bytes };
      }
      default:
        throw new Error(`Unexpected element: ${tag}`);
    }
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
