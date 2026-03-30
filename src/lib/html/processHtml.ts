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
    element: Element;
}

export function processHtml(args: HtmlRuntimeContext): ScElementNode {
    return processElement({
        ...args,
        visit(): void {
            const node = args.tree as ScParentNode;
            const elements = Array.from(walkDom(args.element));

            const scope = elements.map((el) => {
                const type = tagToType(el.tagName.toLowerCase());
                return hydrate({id: randomId(), type}, el);
            });

            checkDuplicateNames(scope);

            const childScope = 'name' in node ? scope : args.scope;

            for (let j = 0; j < scope.length; j++) {
                const s = scope[j] as Record<string, unknown>;
                const childName = typeof s.name === 'string' ? s.name : '';
                const childPath = childName ? (args.path ? `${args.path}.${childName}` : childName) : args.path;
                processHtml({...args, tree: scope[j], scope: childScope, element: elements[j], parentNode: node, path: childPath});
            }
        },
    });
}
