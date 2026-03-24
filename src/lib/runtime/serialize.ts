import type {ScElementNode, ScPluginNode} from "@/types/parsers";
import {isParent, isPlugin} from "@/lib/utils/guards";

export function marshalTree(tree: Record<string, ScElementNode>): ScPluginNode[] {
    return Object.values(tree).filter(isPlugin);
}

export function unmarshalTree(tree: ScPluginNode[]): Record<string, ScElementNode> {
    const result: Record<string, ScElementNode> = {};

    function walk(node: ScElementNode) {
        result[node.id] = node;
        if (isParent(node)) {
            for (const child of node.children) {
                walk(child);
            }
        }
    }

    for (const plugin of tree) {
        walk(plugin);
    }
    return result;
}
