import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import type {ScElementNode, ScElementNodeBase, NodeType, ScParentNode} from "@/types/parsers";
import {isNodeType} from "@/lib/utils/guards";
import {extractProps} from "./handlers";
import {type RuntimeContext, processElement, checkDuplicateNames} from "@/lib/runtime/handlers";

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

export function hydrate(node: { id: string, type: string, [key: string]: unknown }, element: Element): ScElementNodeBase {
    element.setAttribute('id', node.id);
    const props = extractProps(node.type, element);
    return Object.assign(node, props) as ScElementNodeBase;
}

export interface HtmlRuntimeContext extends Omit<RuntimeContext, 'visit'> {
    elements: Element[];
}

export function processHtml(args: HtmlRuntimeContext): ScElementNode {
    return processElement({
        ...args,
        visit(node: ScElementNodeBase): ScElementNode {
            const i = args.scope.indexOf(node);
            const parent = node as ScParentNode;
            const elements = Array.from(walkDom(args.elements[i]));

            const scope = elements.map((el) => {
                return hydrate({id: randomId(), type: tagToType(el.tagName.toLowerCase())}, el);
            });

            checkDuplicateNames(scope);

            const childScope = [...scope, ...args.scope];
            for (let j = 0; j < scope.length; j++) {
                const s = scope[j];
                const childPath = 'name' in s ? (args.path ? `${args.path}.${s.name}` : s.name) : args.path;
                processHtml({...args, tree: scope[j], scope: childScope, elements, parentNode: parent, path: childPath});
            }

            return parent;
        },
    });
}
