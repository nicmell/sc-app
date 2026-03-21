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

function extractProps(type: string, el: Element): Omit<ScElementNodeBase, 'id' | 'type'> {
    switch (type) {
        case ELEMENTS.SC_PLUGIN:   return extractPluginProps();
        case ELEMENTS.SC_GROUP:    return extractGroupProps(el);
        case ELEMENTS.SC_SYNTH:    return extractSynthProps(el);
        case ELEMENTS.SC_SYNTHDEF: return extractSynthDefProps(el);
        case ELEMENTS.SC_UGEN:     return extractUgenProps(el);
        case ELEMENTS.SC_RANGE:    return extractRangeProps(el);
        case ELEMENTS.SC_CHECKBOX: return extractCheckboxProps(el);
        case ELEMENTS.SC_RUN:      return extractRunProps(el);
        case ELEMENTS.SC_DISPLAY:  return extractDisplayProps(el);
        case ELEMENTS.SC_IF:       return extractIfProps(el);
        default: throw new Error(`Unknown element type: ${type}`);
    }
}

export interface WalkContext {
    node: ScElementNodeBase;
    element: Element;
    saved?: ScElementNodeBase;
    nodes: Map<string, ScElementNode>;
}

function hydrate(node: ScElementNodeBase, element: Element, saved?: ScElementNodeBase) {
    const matched = saved?.type === node.type ? saved : undefined;
    if (saved && !matched) {
        console.warn(`[plugin hydration] type mismatch: ${node.type} vs saved ${saved.type}`);
    }
    if (matched && propsMatch(node, matched)) {
        node.id = matched.id;
    } else if (matched) {
        console.warn(`[plugin hydration] props mismatch for ${node.type}`);
    }
    element.setAttribute('id', node.id);
    return node;
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
                const type = tagToType(tag);
                const node = hydrate(
                    {id: randomId(), type, ...extractProps(type, child)} as ScElementNodeBase,
                    child,
                    savedChild,
                )
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
    const node = ctx.node as T;

    Object.assign(ctx.node, {
        runtime: defaultRuntime(ctx.node.type),
    })

    for (const childCtx of visit(ctx)) {
        const childNode = processHtml<ScElementNode>(childCtx);
        if (isParent(node)) {
            node.children.push(childNode);
        }
    }

    ctx.nodes.set(node.id, node as unknown as ScElementNode);
    return node;
}
