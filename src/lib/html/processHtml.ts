import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScElementNodeBase, ScParentNode, ScSynthDefNode, NodeType, RuntimeValueEntry} from "@/types/parsers";
import {isNodeType, isParent} from "@/lib/utils/guards";
import {type HtmlProps, extractProps} from "./handlers";
import {dispatchRuntime, type RuntimeContext} from "@/lib/runtime/handlers";

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


function* visit(el: Element): Generator<Element> {
    for (const child of Array.from(el.children)) {
        const tag = child.tagName.toLowerCase();
        if (isNodeType(tag)) {
            yield child;
        } else {
            yield* visit(child);
        }
    }
}

function hydrate(node: { id: string, type: NodeType }, element: Element, saved?: ScElementNodeBase) {
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

export interface ProcessHtmlArgs {
    rootId: string;
    node: { id: string; type: NodeType };
    element: Element;
    saved?: ScElementNodeBase;
    entries: Map<string, RuntimeValueEntry>;
    synthdefs: ScSynthDefNode[];
    nodesMap: Map<string, ScElementNode>;
    persistedEntries: Record<string, RuntimeValueEntry>;
}

export function processHtml<T extends ScElementNode>(args: ProcessHtmlArgs): T {

    const node = hydrate(args.node, args.element, args.saved) as unknown as T;

    return processElement({
        rootId: args.rootId,
        scope: [node],
        node,
        element: args.element,
        saved: args.saved,
        nodesMap: args.nodesMap,
        synthdefs: args.synthdefs,
        entries: args.entries,
        persistedEntries: args.persistedEntries,
        walk: () => [],
    });
}

export function processElement<T extends ScElementNode = ScElementNode>(ctx: RuntimeContext<T>): T {

    const elements = Array.from(visit(ctx.element));
    const s = ctx.saved && isParent(ctx.saved) ? ctx.saved.children : [];

    const scope = elements
        .map((el, i) => {
            const type = tagToType(el.tagName.toLowerCase());
            return hydrate({id: randomId(), type}, elements[i], s[i]) as ScElementNode
        });

    dispatchRuntime({
        ...ctx,
        walk: () => scope.map((_, i) =>
            processElement({...ctx, scope, node: scope[i], element: elements[i], saved: s[i], parentNode: ctx.node as ScParentNode})
        )
    });

    return ctx.node;
}
