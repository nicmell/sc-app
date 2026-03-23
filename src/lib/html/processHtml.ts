import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScElementNodeBase, ScParentNode, ScSynthDefNode, NodeType, RuntimeValueEntry} from "@/types/parsers";
import {isNodeType, isParent} from "@/lib/utils/guards";
import {type HtmlProps, extractProps} from "./handlers";
import {dispatchRuntime} from "@/lib/runtime/handlers";

const EXCLUDE_KEYS = new Set(['id', 'type', 'runtime', 'children']);

function tagToType(tag: string): NodeType {
    if (tag === 'html') return ELEMENTS.SC_PLUGIN;
    return tag as NodeType;
}

function propsMatch(fresh: HtmlProps<ScElementNodeBase>, saved: ScElementNodeBase): boolean {
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


export interface WalkContext {
    rootId: string;
    scope: ScElementNode[];
    elements: Element[];
    saved: ScElementNodeBase[];
    nodesMap: Map<string, ScElementNode>;
    synthdefs: ScSynthDefNode[];
    entries: Map<string, RuntimeValueEntry>;
    persistedEntries: Record<string, RuntimeValueEntry>;
    offset: number;
    parentNode?: ScParentNode;
}

function *visit(el: Element): Generator<Element> {
    for (const child of Array.from(el.children)) {
        const tag = child.tagName.toLowerCase();
        if (isNodeType(tag)) {
            yield child;
        } else {
            yield* visit(child);
        }
    }
}

function hydrate(node: {id: string, type: NodeType}, element: Element, saved?: ScElementNodeBase) {
    const props = extractProps(node.type, element);
    const matched = saved?.type === node.type ? saved : undefined;
    if (saved && !matched) {
        console.warn(`[plugin hydration] type mismatch: ${node.type} vs saved ${saved.type}`);
    }
    if (matched && propsMatch(props, matched)) {
        node.id = matched.id;
    } else if (matched) {
        console.warn(`[plugin hydration] props mismatch for ${node.type}`);
    }
    element.setAttribute('id', node.id);
    return Object.assign(node, props);
}

export function processHtml<T extends ScElementNode = ScElementNode>(ctx: WalkContext): T {

    const node = ctx.scope[ctx.offset] as T;
    const saved = ctx.saved[ctx.offset];
    const element = ctx.elements[ctx.offset];

    node.runtime = dispatchRuntime(ctx);

    if (isParent(node)) {
        const elements = Array.from(visit(element));
        const s = saved && isParent(saved) ? saved.children : [];

        const scope = elements
            .map((el, i) => {
                const type = tagToType(el.tagName.toLowerCase());
                return hydrate({id: randomId(), type}, elements[i], s[i]) as ScElementNode
            });

        for (let i = 0; i < scope.length; i++) {
            node.children.push(processHtml({...ctx, scope, elements, saved: s, parentNode: node, offset: i}));
        }
    }

    ctx.nodesMap.set(node.id, node);
    return node;
}
