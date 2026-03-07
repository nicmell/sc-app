import {ELEMENTS} from "@/constants/sc-elements";
import {generateId} from "@/lib/utils/generateId";
import type {ScElementNode, PluginTreeEntry} from "./types";
import {compileSynthDef} from "./SynthDefCompiler";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'synthdef', 'class', 'style', 'slot', 'title']);
const PARSED_TAGS: Set<string> = new Set([ELEMENTS.SC_GROUP, ELEMENTS.SC_SYNTH, ELEMENTS.SC_SYNTHDEF]);

const STORAGE_KEY = 'sc-plugin-trees';
const SYNTHDEF_STORAGE_KEY = 'sc-compiled-synthdefs';

interface WalkContext {
  state: Record<string, any>;
  saved?: ScElementNode[];
  offset: number;
}

export class PluginParser {
  private store: Record<string, PluginTreeEntry> = {};
  private synthDefs: Record<string, number[]> = {};

  init(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      Object.assign(this.store, parsed);
    } catch { /* empty */ }
    try {
      const raw = localStorage.getItem(SYNTHDEF_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      Object.assign(this.synthDefs, parsed);
    } catch { /* empty */ }
  }

  getCompiledSynthDef(name: string): Uint8Array | undefined {
    const arr = this.synthDefs[name];
    return arr ? new Uint8Array(arr) : undefined;
  }

  parse(boxId: string, node: Element): PluginTreeEntry {
    const ctx: WalkContext = { state: {}, offset: 0, saved: this.store[boxId]?.tree };
    const tree = this.walkChildren(node, ctx);
    const html = node.innerHTML;
    const entry: PluginTreeEntry = { tree, state: ctx.state, html };
    this.store[boxId] = entry;
    this.persist();
    return entry;
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
    const matched = prev?.tagName === tag ? prev : undefined;
    if (prev && !matched) {
      console.warn(`[plugin hydration] mismatch at index ${ctx.offset}: <${tag}> vs saved <${prev.tagName}>`);
    }
    ctx.offset++;

    const id = this.hydrateId(el, matched);
    const attributes = this.collectAttributes(el);

    if (tag === ELEMENTS.SC_SYNTHDEF) {
      compileSynthDef(el, attributes, this.synthDefs);
      return { id, tagName: tag, attributes, descendants: [] };
    }

    const childState = this.resolveChildState(tag, attributes, ctx.state);
    const descendants = this.walkChildren(el, {
      state: childState,
      saved: matched?.descendants,
      offset: 0,
    });
    return { id, tagName: tag, attributes, descendants };
  }

  private resolveChildState(
    tag: string,
    attributes: Record<string, string>,
    state: Record<string, any>,
  ): Record<string, any> {
    const name = attributes.name;
    switch (tag) {
      case ELEMENTS.SC_GROUP: {
        if (!name) return state;
        const groupState: Record<string, any> = {};
        state[name] = groupState;
        return groupState;
      }
      case ELEMENTS.SC_SYNTH: {
        if (name) {
          const params: Record<string, number> = {};
          for (const [key, value] of Object.entries(attributes)) {
            if (SYNTH_SKIP_ATTRS.has(key)) continue;
            const val = Number(value);
            if (!isNaN(val)) params[key] = val;
          }
          state[name] = params;
        }
        return state;
      }
      default:
        return state;
    }
  }

  private hydrateId(el: Element, saved?: ScElementNode): string {
    const existingId = el.getAttribute('id');
    const id = existingId || (saved ? saved.id : generateId());
    if (!existingId) el.setAttribute('id', id);
    return id;
  }

  private collectAttributes(el: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      attributes[attr.name] = attr.value;
    }
    return attributes;
  }

  private persist(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.store));
    localStorage.setItem(SYNTHDEF_STORAGE_KEY, JSON.stringify(this.synthDefs));
  }
}
