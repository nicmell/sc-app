import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScElementNodeBase, ScParentNode, NodeType} from "@/types/parsers";
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

function* visit(element: Element): Generator<Element> {
    for (const child of Array.from(element.children)) {
        const tag = child.tagName.toLowerCase();
        if (isNodeType(tag)) {
            yield child;
        } else {
            yield* visit(child);
        }
    }
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

export function processHtml<T extends ScElementNode = ScElementNode>(ctx: WalkContext): T {
    const {element, saved, nodes} = ctx;
    const node = hydrateNode<T>(element, ctx.node, saved);

    const savedChildren =
        saved?.type === node.type && isParent(saved) ? saved.children : [];

    let offset = 0;
    for (const child of visit(element)) {
        const savedChild = savedChildren[offset];
        (node as unknown as ScParentNode).children.push(
            processHtml<ScElementNode>({node: {type: tagToType(child.tagName)}, element: child, saved: savedChild, nodes})
        );
        offset++;
    }

    nodes.set(node.id, node as unknown as ScElementNode);
    return node;
}
