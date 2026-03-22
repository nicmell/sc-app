import type {ScElementNode, ScParentNode, ScPluginNode, PluginRuntime, RuntimeValueEntry} from "@/types/parsers";
import {isParent} from "@/lib/utils/guards";
import {type RuntimeContext, dispatchRuntime, processPluginRuntime} from "./handlers";

function walkTree(
    siblings: ScElementNode[],
    parentNode: ScParentNode | undefined,
    ctx: Omit<RuntimeContext, 'scope' | 'parentNode' | 'node'>,
): void {
    // 1. Recurse into children of parent nodes FIRST
    for (const node of siblings) {
        if (isParent(node)) {
            walkTree(node.children, node, ctx);
        }
    }
    // 2. Then process all siblings at this level
    const levelCtx: Omit<RuntimeContext, 'node'> = {...ctx, scope: siblings, parentNode};
    for (const node of siblings) {
        node.runtime = dispatchRuntime({...levelCtx, node});
    }
}

export function processRuntime(
    boxId: string,
    tree: ScElementNode[],
    nodes: Map<string, ScElementNode>,
    persistedEntries: Record<string, RuntimeValueEntry>,
): {tree: ScElementNode[]; entries: Record<string, RuntimeValueEntry>; pluginRuntime: PluginRuntime} {
    const entries = new Map<string, RuntimeValueEntry>();

    walkTree(tree, undefined, {boxId, entries, persistedEntries, nodes});

    // Create runtime entries for the plugin node itself
    const pluginNode = {type: 'sc-plugin', id: boxId, children: tree, runtime: {run: '', controls: {}, loaded: false}} as ScPluginNode;
    const pluginRuntime = processPluginRuntime({node: pluginNode, boxId, entries, persistedEntries, nodes, scope: tree});

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of entries) {
        values[id] = entry;
    }

    return {tree, entries: values, pluginRuntime};
}
