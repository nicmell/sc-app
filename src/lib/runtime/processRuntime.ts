import type {ScElementNode, ScPluginNode, PluginRuntime, RuntimeValueEntry} from "@/types/parsers";
import {isParent} from "@/lib/utils/guards";
import {type RuntimeContext, dispatchRuntime} from "./handlers";

function walkTree(ctx: RuntimeContext): void {
    // 1. Recurse into children of parent nodes FIRST
    for (const node of ctx.scope) {
        if (isParent(node)) {
            walkTree({...ctx, scope: node.children, parentNode: node});
        }
    }
    // 2. Then process all siblings at this level
    for (let i = 0; i < ctx.scope.length; i++) {
        ctx.scope[i].runtime = dispatchRuntime({...ctx, offset: i});
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
    walkTree({rootId, entries, persistedEntries, nodesMap, scope: [pluginNode], offset: 0});

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of entries) {
        values[id] = entry;
    }

    return {tree, entries: values, pluginRuntime: pluginNode.runtime};
}
