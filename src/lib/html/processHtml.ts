import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScElementNodeBase, NodeType} from "@/types/parsers";
import {isNodeType, isParent} from "@/lib/utils/guards";
import {
    extractPluginProps,
    extractGroupProps,
    extractSynthProps,
    extractSynthDefProps,
    extractUgenProps,
    extractRangeProps,
    extractCheckboxProps,
    extractRunProps,
    extractDisplayProps,
    extractIfProps,
} from "./handlers";

const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children']);
const NODE_TYPES: ReadonlySet<string> = new Set([ELEMENTS.SC_GROUP, ELEMENTS.SC_SYNTH, ELEMENTS.SC_PLUGIN]);
const INPUT_TYPES: ReadonlySet<string> = new Set([ELEMENTS.SC_RANGE, ELEMENTS.SC_CHECKBOX, ELEMENTS.SC_RUN, ELEMENTS.SC_DISPLAY, ELEMENTS.SC_IF]);

function tagToType(tag: string): NodeType {
    if (tag === 'html') return ELEMENTS.SC_PLUGIN;
    return tag as NodeType;
}

function defaultRuntime(type: string): Record<string, unknown> {
    if (type === ELEMENTS.SC_PLUGIN) return {run: '', controls: {}, loaded: false};
    if (NODE_TYPES.has(type)) return {run: '', controls: {}};
    if (INPUT_TYPES.has(type)) return {value: ''};
    return {};
}

function propsMatch(fresh: ScElementNodeBase, saved: ScElementNodeBase): boolean {
    const freshProps: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(fresh)) {
        if (!EXCLUDE_KEYS.has(key)) freshProps[key] = val;
    }
    const savedProps: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(saved)) {
        if (!EXCLUDE_KEYS.has(key)) savedProps[key] = val;
    }
    return deepEqual(freshProps, savedProps);
}

function extractProps(id: string, type: string, el: Element): ScElementNodeBase {
    switch (type) {
        case ELEMENTS.SC_PLUGIN:   return extractPluginProps(id);
        case ELEMENTS.SC_GROUP:    return extractGroupProps(id, el);
        case ELEMENTS.SC_SYNTH:    return extractSynthProps(id, el);
        case ELEMENTS.SC_SYNTHDEF: return extractSynthDefProps(id, el);
        case ELEMENTS.SC_UGEN:     return extractUgenProps(id, el);
        case ELEMENTS.SC_RANGE:    return extractRangeProps(id, el);
        case ELEMENTS.SC_CHECKBOX: return extractCheckboxProps(id, el);
        case ELEMENTS.SC_RUN:      return extractRunProps(id, el);
        case ELEMENTS.SC_DISPLAY:  return extractDisplayProps(id, el);
        case ELEMENTS.SC_IF:       return extractIfProps(id, el);
        default: throw new Error(`Unknown element type: ${type}`);
    }
}

function hydrateId(node: ScElementNodeBase, saved?: ScElementNodeBase): string {
    const matched = saved?.type === node.type ? saved : undefined;
    if (saved && !matched) {
        console.warn(`[plugin hydration] type mismatch: ${node.type} vs saved <${saved.type}>`);
    }
    if (matched && propsMatch(node, matched)) {
        return matched.id;
    }
    if (matched) {
        console.warn(`[plugin hydration] props mismatch for ${node.type}`);
    }
    return node.id;
}

export interface WalkContext {
    node: ScElementNodeBase;
    element: Element;
    saved?: ScElementNodeBase;
    nodes: Map<string, ScElementNode>;
}

function visit(ctx: WalkContext): WalkContext[] {
    const {saved, nodes} = ctx;
    const savedChildren =
        saved?.type === ctx.node.type && isParent(saved) ? saved.children : [];
    const result: WalkContext[] = [];
    let offset = 0;

    function walk(element: Element): void {
        for (const child of Array.from(element.children)) {
            const tag = child.tagName.toLowerCase();
            if (isNodeType(tag)) {
                const savedChild = savedChildren[offset];
                const type = tagToType(child.tagName);
                const node = extractProps(randomId(), type, child);
                node.id = hydrateId(node, savedChild);
                child.setAttribute('id', node.id);
                result.push({node, element: child, saved: savedChild, nodes});
                offset++;
            } else {
                walk(child);
            }
        }
    }

    walk(ctx.element);
    return result;
}

export function processHtml<T extends ScElementNode = ScElementNode>(ctx: WalkContext): T {
    const node = Object.assign(ctx.node, {
        runtime: defaultRuntime(ctx.node.type),
    }) as unknown as T;

    for (const childCtx of visit(ctx)) {
        const childNode = processHtml<ScElementNode>(childCtx);
        if (isParent(node)) {
            node.children.push(childNode);
        }
    }

    ctx.nodes.set(node.id, node as unknown as ScElementNode);
    return node;
}
