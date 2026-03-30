import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import type {ScElementNode, NodeType, ScParentNode} from "@/types/parsers";
import {isNodeType} from "@/lib/utils/guards";
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

export function hydrate<T extends ScElementNode>(node: { id: string, type: T["type"] }, element: Element) {
    const props = extractProps(node.type, element);
    element.setAttribute('id', node.id);
    return Object.assign(node, props);
}

export type HtmlRuntimeContext<T extends ScElementNode = ScElementNode> = Omit<RuntimeContext<T>, 'visit'>

export function processHtml<T extends ScElementNode>(args: HtmlRuntimeContext<T>): T {
    return processElement({
        ...args,
        visit(i: number): ScElementNode {
            const node = args.scope[i] as ScParentNode;
            const elements = Array.from(walkDom(args.elements[i]));

            const scope = elements
                .map((el) => {
                    const type = tagToType(el.tagName.toLowerCase());
                    return hydrate({id: randomId(), type}, el) as unknown as ScElementNode
                });

            for (let j = 0; j < scope.length; j++) {
                const s = scope[j] as unknown as Record<string, unknown>;
                const childName = typeof s.name === 'string' ? s.name : '';
                const childPath = childName ? (args.path ? `${args.path}.${childName}` : childName) : args.path;
                processHtml({...args, offset: j, scope, tree: scope[j], elements, parentNode: node, path: childPath});
            }

            return node;
        },
    });
}
