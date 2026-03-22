import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScElementNodeBase, NodeType} from "@/types/parsers";
import {isNodeType, isParent} from "@/lib/utils/guards";
import type {HtmlProps} from "./handlers";
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

const EXCLUDE_KEYS = new Set(['id', 'type', 'runtime', 'children']);
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

function propsMatch(fresh: HtmlProps<ScElementNodeBase>, saved: ScElementNodeBase): boolean {
    const savedProps: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(saved)) {
        if (!EXCLUDE_KEYS.has(key)) savedProps[key] = val;
    }
    return deepEqual(fresh, savedProps);
}

function extractProps(type: string, el: Element): Omit<ScElementNodeBase, 'id' | 'type'> {
    switch (type) {
        case ELEMENTS.SC_PLUGIN:
            return {children: [], ...extractPluginProps(el)};
        case ELEMENTS.SC_GROUP:
            return {children: [], ...extractGroupProps(el)};
        case ELEMENTS.SC_SYNTH:
            return extractSynthProps(el);
        case ELEMENTS.SC_SYNTHDEF:
            return {children: [], ...extractSynthDefProps(el)};
        case ELEMENTS.SC_UGEN:
            return extractUgenProps(el);
        case ELEMENTS.SC_RANGE:
            return extractRangeProps(el);
        case ELEMENTS.SC_CHECKBOX:
            return extractCheckboxProps(el);
        case ELEMENTS.SC_RUN:
            return extractRunProps(el);
        case ELEMENTS.SC_DISPLAY:
            return extractDisplayProps(el);
        case ELEMENTS.SC_IF:
            return {children: [], ...extractIfProps(el)};
        default:
            throw new Error(`Unknown element type: ${type}`);
    }
}

export interface WalkContext {
    node: ScElementNodeBase;
    element: Element;
    saved?: ScElementNodeBase;
    nodes: Map<string, ScElementNode>;
    offset: number;
}

function hydrate<T extends ScElementNode>(
    node: {id: string, type: T["type"]},
    props: HtmlProps<T>,
    saved?: ScElementNodeBase
) {
    const matched = saved?.type === node.type ? saved : undefined;
    if (saved && !matched) {
        console.warn(`[plugin hydration] type mismatch: ${node.type} vs saved ${saved.type}`);
    }
    if (matched && propsMatch(props, matched)) {
        node.id = matched.id;
    } else if (matched) {
        console.warn(`[plugin hydration] props mismatch for ${node.type}`);
    }
    return Object.assign(node, props) as unknown as T;
}

function processElement(ctx: WalkContext): ScElementNode {
    const node = hydrate(
        ctx.node as {id: string, type: ScElementNode["type"]},
        extractProps(ctx.node.type, ctx.element),
        ctx.saved,
    );
    Object.assign(node, {runtime: defaultRuntime(node.type)});
    ctx.element.setAttribute('id', node.id);
    for (const child of walk(ctx)) {
        if (isParent(node)) {
            node.children.push(child);
        }
    }
    ctx.nodes.set(node.id, node as unknown as ScElementNode);
    return node as unknown as ScElementNode;
}

function walk(ctx: WalkContext): ScElementNode[] {
    const savedChildren = ctx.saved && isParent(ctx.saved) ? ctx.saved.children : [];
    const result: ScElementNode[] = [];

    for (const child of Array.from(ctx.element.children)) {
        const tag = child.tagName.toLowerCase();
        if (isNodeType(tag)) {
            const savedChild = savedChildren[ctx.offset];
            const type = tagToType(tag);
            result.push(processElement({node: {id: randomId(), type} as ScElementNodeBase, element: child, saved: savedChild, nodes: ctx.nodes, offset: 0}));
            ctx.offset++;
        } else {
            const nested = walk({...ctx, element: child});
            result.push(...nested);
            ctx.offset += nested.length;
        }
    }

    return result;
}

export function processHtml<T extends ScElementNode = ScElementNode>(ctx: WalkContext): T {
    return processElement(ctx) as T;
}
