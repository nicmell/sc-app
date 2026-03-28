import {ELEMENTS} from "@/constants/sc-elements";
import {randomId, cyrb53} from "@/lib/utils/randomId";
import type {ScElementNode, ScElementNodeBase, NodeType, ScParentNode} from "@/types/parsers";
import {isNodeType, isParent} from "@/lib/utils/guards";
import {extractProps} from "./handlers";
import {type RuntimeContext, processElement} from "@/lib/runtime/handlers";

function tagToType(tag: string): NodeType {
    if (tag === 'html') return ELEMENTS.SC_PLUGIN;
    return tag as NodeType;
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
    const {children: _children, ...identityProps} = props as any;
    const hash = cyrb53(JSON.stringify(identityProps));
    const matched = saved?.type === node.type && saved.hash === hash ? saved : undefined;

    if (matched) {
        node.id = matched.id;
        const {id: _id, type: _type, hash: _hash, children: _children, ...restoredProps} = matched as any;
        element.setAttribute('id', node.id);
        return Object.assign(node, props, restoredProps);
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
