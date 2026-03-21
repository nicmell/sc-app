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

function tagToType(tag: string): NodeType {
    if (tag === 'html') return ELEMENTS.SC_PLUGIN;
    return tag as NodeType;
}

function propsMatch(fresh: Record<string, unknown>, saved: ScElementNodeBase): boolean {
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

function extractProps(type: string, el: Element): Record<string, unknown> {
    switch (type) {
        case ELEMENTS.SC_PLUGIN:
            return {type, ...extractPluginProps()};
        case ELEMENTS.SC_GROUP:
            return {type, ...extractGroupProps(el)};
        case ELEMENTS.SC_SYNTH:
            return {type, ...extractSynthProps(el)};
        case ELEMENTS.SC_SYNTHDEF:
            return {type, ...extractSynthDefProps(el)};
        case ELEMENTS.SC_UGEN:
            return {type, ...extractUgenProps(el)};
        case ELEMENTS.SC_RANGE:
            return {type, ...extractRangeProps(el)};
        case ELEMENTS.SC_CHECKBOX:
            return {type, ...extractCheckboxProps(el)};
        case ELEMENTS.SC_RUN:
            return {type, ...extractRunProps(el)};
        case ELEMENTS.SC_DISPLAY:
            return {type, ...extractDisplayProps(el)};
        case ELEMENTS.SC_IF:
            return {type, ...extractIfProps(el)};
        default:
            return {type};
    }
}

function hydrateId(
    type: NodeType,
    defaultId: string,
    props: Record<string, unknown>,
    saved?: ScElementNodeBase,
): string {
    const matched = saved?.type === type ? saved : undefined;
    if (saved && !matched) {
        console.warn(`[plugin hydration] type mismatch: ${type} vs saved <${saved.type}>`);
    }
    if (matched && propsMatch(props, matched)) {
        return matched.id;
    }
    if (matched) {
        console.warn(`[plugin hydration] props mismatch for ${type}`);
    }
    return defaultId;
}

export interface WalkContext {
    node: { type: NodeType; id: string };
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
                const props = extractProps(type, child);
                const id = hydrateId(type, randomId(), props, savedChild);
                child.setAttribute('id', id);
                result.push({node: {id, type}, element: child, saved: savedChild, nodes});
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
    const {element, saved, nodes} = ctx;
    const props = extractProps(ctx.node.type, element);
    const id = hydrateId(ctx.node.type, ctx.node.id, props, saved);
    element.setAttribute('id', id);
    const node = {id, ...props} as unknown as T;

    for (const childCtx of visit({...ctx, node: {id, type: ctx.node.type}})) {
        const childNode = processHtml<ScElementNode>(childCtx);
        if (isParent(node)) {
            node.children.push(childNode);
        }
    }

    nodes.set(id, node as unknown as ScElementNode);
    return node;
}
