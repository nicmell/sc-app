import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScElementNodeBase, ScParentNode, NodeType, RuntimeValueEntry} from "@/types/parsers";
import {isNodeType, isParent} from "@/lib/utils/guards";
import {type HtmlProps, extractProps} from "./handlers";

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


export interface WalkContext {
    scope: ScElementNode[];
    elements: Element[];
    saved: ScElementNodeBase[];
    nodesMap: Map<string, ScElementNode>;
    entries: Map<string, RuntimeValueEntry>;
    persistedEntries: Record<string, RuntimeValueEntry>;
    offset: number;
    parentNode?: ScParentNode;
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
    return Object.assign(node, props);
}

function hydrateNode(node: {id: string, type: NodeType}, element: Element, saved?: ScElementNodeBase) {
    const hydrated = hydrate(node, extractProps(node.type, element), saved);
    element.setAttribute('id', hydrated.id);
    return hydrated;
}

function processElement(ctx: WalkContext): ScElementNode {
    const node = ctx.scope[ctx.offset];

    Object.assign(node, {runtime: defaultRuntime(node.type)});

    for (const childCtx of walk(ctx)) {
        const child = processElement(childCtx);
        if (isParent(node)) {
            node.children.push(child);
        }
    }
    ctx.nodesMap.set(node.id, node);
    return node;
}

function walk(ctx: WalkContext): WalkContext[] {
    const element = ctx.elements[ctx.offset];
    const currentSaved = ctx.saved[ctx.offset];
    const savedChildren = currentSaved && isParent(currentSaved) ? currentSaved.children : [];
    const parentNode = ctx.scope[ctx.offset] as ScParentNode;

    const scope: ScElementNode[] = [];
    const elements: Element[] = [];
    const saved: ScElementNodeBase[] = [];
    const result: WalkContext[] = [];

    let savedOffset = 0;
    function collect(el: Element): void {
        for (const child of Array.from(el.children)) {
            const tag = child.tagName.toLowerCase();
            if (isNodeType(tag)) {
                const s = savedChildren[savedOffset];
                const node = hydrateNode({id: randomId(), type: tagToType(tag)}, child, s);
                scope.push(node as unknown as ScElementNode);
                elements.push(child);
                saved.push(s);
                result.push({...ctx, scope, elements, saved, offset: savedOffset, parentNode});
                savedOffset++;
            } else {
                collect(child);
            }
        }
    }
    collect(element);

    return result;
}

export function processHtml<T extends ScElementNode = ScElementNode>(ctx: WalkContext): T {
    hydrateNode(
        ctx.scope[ctx.offset] as unknown as {id: string, type: NodeType},
        ctx.elements[ctx.offset],
        ctx.saved[ctx.offset],
    );
    return processElement(ctx) as T;
}
