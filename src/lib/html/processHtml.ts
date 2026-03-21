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

const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children', 'loaded', 'error', 'title']);

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

export interface WalkContext {
    node: { type: NodeType; id?: string };
    element: Element;
    saved?: ScElementNodeBase;
    nodes: Map<string, ScElementNode>;
}

function hydrateNode<T extends ScElementNode>(
    element: Element,
    node: { type: NodeType; id?: string },
    saved?: ScElementNodeBase,
): T {
    const matched = saved?.type === node.type ? saved : undefined;
    if (saved && !matched) {
        console.warn(`[plugin hydration] type mismatch: ${node.type} vs saved <${saved.type}>`);
    }
    const props = extractProps(node.type, element);

    if (matched && propsMatch(props, matched)) {
        node.id = matched.id;
    } else {
        if (matched) console.warn(`[plugin hydration] props mismatch for ${node.type}`);
        if (!node.id) node.id = randomId();
    }
    element.setAttribute('id', node.id);

    return Object.assign(node, props) as unknown as T;
}

function visit(ctx: WalkContext, offset = {value: 0}): WalkContext[] {
    const {saved, nodes} = ctx;
    const savedChildren =
        saved?.type === ctx.node.type && isParent(saved) ? saved.children : [];
    const result: WalkContext[] = [];

    for (const child of Array.from(ctx.element.children)) {
        const tag = child.tagName.toLowerCase();
        if (isNodeType(tag)) {
            const savedChild = savedChildren[offset.value];
            const childNode = hydrateNode(child, {type: tagToType(child.tagName)}, savedChild);
            result.push({node: childNode, element: child, saved: savedChild, nodes});
            offset.value++;
        } else {
            result.push(...visit({...ctx, element: child}, offset));
        }
    }
    return result;
}

export function processHtml<T extends ScElementNode = ScElementNode>(ctx: WalkContext): T {
    const node = hydrateNode<T>(ctx.element, ctx.node, ctx.saved);

    for (const childCtx of visit(ctx)) {
        const childNode = processHtml<ScElementNode>(childCtx);
        if (isParent(node)) {
            node.children.push(childNode);
        }
    }

    ctx.nodes.set(node.id, node as unknown as ScElementNode);
    return node;
}
