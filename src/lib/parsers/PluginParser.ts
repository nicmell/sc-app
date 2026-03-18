import {ELEMENTS} from "@/constants/sc-elements";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScPluginNode, NodeRuntime, RuntimeValueEntry} from "../../types/parsers";
import {
    extractGroupProps, extractSynthProps, extractSynthDefProps,
    extractRangeProps, extractCheckboxProps, extractRunProps,
    extractDisplayProps, extractIfProps,
} from "./extractProps";
import {processPluginRuntime} from "./processRuntime";

const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children']);
const SC_TAGS: ReadonlySet<string> = new Set([
    ELEMENTS.SC_GROUP, ELEMENTS.SC_SYNTH, ELEMENTS.SC_SYNTHDEF,
    ELEMENTS.SC_RANGE, ELEMENTS.SC_CHECKBOX, ELEMENTS.SC_RUN,
    ELEMENTS.SC_DISPLAY, ELEMENTS.SC_IF,
]);


export interface WalkContext {
    element: Element;
    saved?: ScElementNode;
    boxId: string;
    offset: number;
    runtime: Map<string, RuntimeValueEntry>;
    parentNode?: ScElementNode;
    scope: ScElementNode[];
    walk: (ctx: WalkContext) => ScElementNode[];
}

export interface ParseResult {
    tree: ScElementNode[];
    values: Record<string, RuntimeValueEntry>;
    runtime: NodeRuntime;
}


export function parse(element: Element, saved?: ScElementNode, boxId?: string): ParseResult {
    const ctx: WalkContext = {
        element,
        saved,
        boxId: boxId ?? '',
        offset: 0,
        runtime: new Map<string, RuntimeValueEntry>(),
        scope: [],
        walk: walkChildren,
    };
    const tree = walkChildren(ctx);

    // Create runtime entries for the plugin node itself
    const pluginNode = {type: 'sc-plugin', id: ctx.boxId} as ScPluginNode;
    ctx.scope = tree;
    processPluginRuntime(pluginNode, ctx);

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of ctx.runtime) {
        values[id] = entry;
    }
    return {tree, values, runtime: pluginNode.runtime};
}

function propsMatch(fresh: ScElementNode, saved: ScElementNode): boolean {
    const strip = (node: ScElementNode) => {
        const props: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(node)) {
            if (!EXCLUDE_KEYS.has(key)) props[key] = val;
        }
        return props;
    };
    return deepEqual(strip(fresh), strip(saved));
}

function extractNode(tag: string, el: Element, ctx: WalkContext): ScElementNode {
    switch (tag) {
        case ELEMENTS.SC_GROUP:    return extractGroupProps(el, ctx);
        case ELEMENTS.SC_SYNTH:    return extractSynthProps(el);
        case ELEMENTS.SC_SYNTHDEF: return extractSynthDefProps(el);
        case ELEMENTS.SC_RANGE:    return extractRangeProps(el);
        case ELEMENTS.SC_CHECKBOX: return extractCheckboxProps(el);
        case ELEMENTS.SC_RUN:      return extractRunProps(el);
        case ELEMENTS.SC_DISPLAY:  return extractDisplayProps(el);
        case ELEMENTS.SC_IF:       return extractIfProps(el, ctx);
        default: throw new Error(`Unknown element: <${tag}>`);
    }
}


function processElement(ctx: WalkContext): ScElementNode {
    const tag = ctx.element.tagName.toLowerCase();
    const savedChildren = ctx.saved && 'children' in ctx.saved ? ctx.saved.children : undefined;
    const savedChild = savedChildren?.[ctx.offset];
    const matched = savedChild?.type === tag ? savedChild : undefined;
    if (savedChild && !matched) {
        console.warn(`[plugin hydration] tag mismatch at offset ${ctx.offset}: <${tag}> vs saved <${savedChild.type}>`);
    }

    const node = extractNode(tag, ctx.element, {...ctx, saved: matched});

    if (matched && propsMatch(node, matched)) {
        node.id = matched.id;
        ctx.element.setAttribute('id', matched.id);
    } else {
        if (matched) console.warn(`[plugin hydration] props mismatch for <${tag}>`);
        ctx.element.setAttribute('id', node.id);
    }

    return node;
}

export function walkChildren(ctx: WalkContext): ScElementNode[] {
    function visit(element: Element): ScElementNode[] {
        const result: ScElementNode[] = [];
        for (const child of Array.from(element.children)) {
            const tag = child.tagName.toLowerCase();
            if (SC_TAGS.has(tag)) {
                result.push(processElement({...ctx, element: child}));
                ctx.offset++;
            } else {
                result.push(...visit(child));
            }
        }
        return result;
    }

    return visit(ctx.element);
}
