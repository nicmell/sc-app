import type {ScElementNode, ScParentNode, ScPluginNode, PluginRuntime, RuntimeValueEntry} from "@/types/parsers";
import {isParent} from "@/lib/utils/guards";
import {type RuntimeContext, dispatchRuntime} from "./handlers";

function walkTree(
    siblings: ScElementNode[],
    parentNode: ScParentNode | undefined,
    ctx: RuntimeContext,
): void {
    // 1. Recurse into children of parent nodes FIRST
    for (const node of siblings) {
        if (isParent(node)) {
            walkTree(node.children, node, ctx);
        }
    }
    // 2. Then process all siblings at this level
    for (let i = 0; i < siblings.length; i++) {
        siblings[i].runtime = dispatchRuntime({...ctx, scope: siblings, parentNode, offset: i});
    }
}

export function processRuntime(
    rootId: string,
    tree: ScElementNode[],
    nodesMap: Map<string, ScElementNode>,
    persistedEntries: Record<string, RuntimeValueEntry>,
): {tree: ScElementNode[]; entries: Record<string, RuntimeValueEntry>; pluginRuntime: PluginRuntime} {

    const entries = new Map<string, RuntimeValueEntry>();
    const pluginNode = {type: 'sc-plugin', id: rootId, children: tree, runtime: {run: '', controls: {}, loaded: false}} as ScPluginNode;
    const ctx: RuntimeContext = {rootId, entries, persistedEntries, nodesMap, scope: [], offset: 0};

    walkTree([pluginNode], undefined, ctx);

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of entries) {
        values[id] = entry;
    }

    return {tree, entries: values, pluginRuntime: pluginNode.runtime};
}
