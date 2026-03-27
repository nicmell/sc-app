import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScElementNodeBase, ScSynthDefNode, NodeType, RuntimeValueEntry, StripRuntime, ScParentNode} from "@/types/parsers";
import {isNodeType, isParent} from "@/lib/utils/guards";
import {type HtmlProps, extractProps} from "./handlers";
import {checkDuplicateNames, type RuntimeContext, processElement} from "@/lib/runtime/handlers";

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


function* walkDom(el: Element): Generator<Element> {
    for (const child of Array.from(el.children)) {
        const tag = child.tagName.toLowerCase();
        if (isNodeType(tag)) {
            yield child;
        } else {
            yield* walkDom(child);
        }
    }
}

export function hydrate<T extends ScElementNode>(node: { id: string, type: T["type"] }, element: Element, saved?: ScElementNodeBase) {
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

export interface ProcessHtmlArgs<T extends ScElementNode> {
    rootId: string;
    tree: StripRuntime<T>;
    element: Element;
    saved?: ScElementNodeBase;
    entries: Record<string, RuntimeValueEntry>;
    synthdefs: ScSynthDefNode[];
    nodes: Record<string, ScElementNode>;
}

export function processHtml<T extends ScElementNode>(args: ProcessHtmlArgs<T>): T {
    return processElement({
        rootId: args.rootId,
        scope: [args.tree],
        tree: args.tree,
        parentNode: undefined,
        element: args.element,
        saved: args.saved,
        nodes: args.nodes,
        synthdefs: args.synthdefs,
        entries: args.entries,
        visit(this: RuntimeContext) {
            const elements = Array.from(walkDom(this.element));

            const parentMatch = this.tree.id === this.saved?.id;
            const savedChildren = parentMatch && this.saved && isParent(this.saved) ? this.saved.children : [];

            const scope = elements
                .map((el, i) => {
                    const type = tagToType(el.tagName.toLowerCase());
                    return hydrate({id: randomId(), type}, elements[i], savedChildren[i]) as ScElementNode
                });

            checkDuplicateNames(scope);

            const parent = this.tree as ScParentNode;
            for (let i = 0; i < scope.length; i++) {
                parent.children.push(
                    processElement({...this, scope, tree: scope[i], element: elements[i], saved: savedChildren[i], parentNode: parent})
                );
            }
            return parent.children;
        },
    });
}
