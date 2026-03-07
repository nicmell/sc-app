import {ELEMENTS} from "@/constants/sc-elements";
import {generateId} from "@/lib/utils/generateId";

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

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'synthdef', 'class', 'style', 'slot', 'title']);

interface ParseContext {
  state: Record<string, any>;
  saved?: ScElementNode[];
  offset: number;
}

type TagHandler = (current: ScElementNode, state: Record<string, any>) => Record<string, any>;

function handleGroup(current: ScElementNode, state: Record<string, any>): Record<string, any> {
  const name = current.attributes.name;
  if (!name) return state;
  const groupState: Record<string, any> = {};
  state[name] = groupState;
  return groupState;
}

function handleSynth(current: ScElementNode, state: Record<string, any>): Record<string, any> {
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

const tagNames = new Set<string>(Object.values(ELEMENTS));

const tagHandlers: Partial<Record<string, TagHandler>> = {
  [ELEMENTS.SC_GROUP]: handleGroup,
  [ELEMENTS.SC_SYNTH]: handleSynth,
};

const STORAGE_KEY = 'sc-plugin-trees';

export class ElementTreeParser {
  private store: Record<string, PluginTreeEntry> = {};

  init(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.store = raw ? JSON.parse(raw) : {};
    } catch {
      this.store = {};
    }
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
    const handler = tagHandlers[tag] ?? ((_current, state) => state);
    const childState = handler(current, ctx.state);
    current.descendants = this.buildTree(el, {
      state: childState,
      saved: rehydrated ? prev.descendants : undefined,
      offset: 0,
    });
    return current;
  }
}
