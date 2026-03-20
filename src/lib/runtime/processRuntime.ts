import type {ScElementNode, ScElementNodeBase, ScPluginNode, StripRuntime, RuntimeValueEntry, NodeRuntime} from "@/types/parsers";
import {isParent} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";
import {
    type RuntimeContext,
    processPluginRuntime, processGroupRuntime, processSynthRuntime, processSynthDefRuntime,
    processRangeRuntime, processCheckboxRuntime, processRunRuntime,
    processDisplayRuntime, processIfRuntime,
} from "./handlers";

function dispatchRuntime(node: ScElementNodeBase, ctx: RuntimeContext): void {
    switch (node.type) {
        case ELEMENTS.SC_GROUP:    processGroupRuntime(node, ctx); break;
        case ELEMENTS.SC_SYNTH:    processSynthRuntime(node, ctx); break;
        case ELEMENTS.SC_SYNTHDEF: processSynthDefRuntime(node, ctx); break;
        case ELEMENTS.SC_RANGE:    processRangeRuntime(node, ctx); break;
        case ELEMENTS.SC_CHECKBOX: processCheckboxRuntime(node, ctx); break;
        case ELEMENTS.SC_RUN:      processRunRuntime(node, ctx); break;
        case ELEMENTS.SC_DISPLAY:  processDisplayRuntime(node, ctx); break;
        case ELEMENTS.SC_IF:       processIfRuntime(node, ctx); break;
    }
}

function walkTree(
    siblings: ScElementNodeBase[],
    parentNode: ScElementNodeBase | undefined,
    ctx: Omit<RuntimeContext, 'scope' | 'parentNode'>,
): void {
    // 1. Recurse into children of parent nodes FIRST
    for (const node of siblings) {
        if (isParent(node)) {
            walkTree(node.children, node, ctx);
        }
    }
    // 2. Then process all siblings at this level
    const levelCtx: RuntimeContext = {...ctx, scope: siblings, parentNode};
    for (const node of siblings) {
        dispatchRuntime(node, levelCtx);
    }
}

export function processRuntime(
    boxId: string,
    tree: ScElementNodeBase[],
    _nodes: Map<string, ScElementNodeBase>,
    persistedEntries: Record<string, RuntimeValueEntry>,
): {tree: ScElementNode[]; entries: Record<string, RuntimeValueEntry>; pluginRuntime: NodeRuntime} {
    const entries = new Map<string, RuntimeValueEntry>();

    walkTree(tree, undefined, {boxId, entries, persistedEntries});

    // Create runtime entries for the plugin node itself
    const pluginNode = {type: 'sc-plugin', id: boxId} as StripRuntime<ScPluginNode>;
    const pluginCtx: RuntimeContext = {boxId, entries, persistedEntries, scope: tree};
    const pluginRuntime = processPluginRuntime(pluginNode, pluginCtx);

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of entries) {
        values[id] = entry;
    }

    return {
        tree: tree as ScElementNode[],
        entries: values,
        pluginRuntime,
    };
}
