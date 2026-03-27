import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScElementNodeBase, NodeType, ScParentNode} from "@/types/parsers";
import {isNodeType, isParent} from "@/lib/utils/guards";
import {type HtmlProps, extractProps} from "./handlers";
import {type RuntimeContext, processElement} from "@/lib/runtime/handlers";

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

export type HtmlRuntimeContext<T extends ScElementNode = ScElementNode> = Omit<RuntimeContext<T>, 'visit'> & {
    element: Element;
    saved?: ScElementNodeBase;
};

export function processHtml<T extends ScElementNode>(args: HtmlRuntimeContext<T>): T {
    const {element, saved, ...rest} = args;
    return processElement({
        ...rest,
        visit() {
            const elements = Array.from(walkDom(element));

            const parentMatch = rest.tree.id === saved?.id;
            const savedChildren = parentMatch && saved && isParent(saved) ? saved.children : [];

            const scope = elements
                .map((el, i) => {
                    const type = tagToType(el.tagName.toLowerCase());
                    return hydrate({id: randomId(), type}, elements[i], savedChildren[i]) as ScElementNode
                });

            const parent = rest.tree as ScParentNode;
            for (let i = 0; i < scope.length; i++) {
                parent.children.push(
                    processHtml({...args, scope, tree: scope[i], element: elements[i], saved: savedChildren[i], parentNode: parent})
                );
            }
        },
    });
}
