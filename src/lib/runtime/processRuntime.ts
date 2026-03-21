import type {ScElementNode, ScParentNode, ScPluginNode, RuntimeValueEntry, NodeRuntime} from "@/types/parsers";
import {isParent} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";
import {
    type RuntimeContext,
    processPluginRuntime, processGroupRuntime, processSynthRuntime, processSynthDefRuntime,
    processUgenRuntime, processControlRuntime, processRunRuntime, processVisualRuntime,
} from "./handlers";

function dispatchRuntime(node: ScElementNode, ctx: RuntimeContext): void {
    switch (node.type) {
        case ELEMENTS.SC_GROUP:    processGroupRuntime(node, ctx); break;
        case ELEMENTS.SC_SYNTH:    processSynthRuntime(node, ctx); break;
        case ELEMENTS.SC_SYNTHDEF: processSynthDefRuntime(node, ctx); break;
        case ELEMENTS.SC_UGEN:     processUgenRuntime(node, ctx); break;
        case ELEMENTS.SC_RANGE:
        case ELEMENTS.SC_CHECKBOX: processControlRuntime(node, ctx); break;
        case ELEMENTS.SC_RUN:      processRunRuntime(node, ctx); break;
        case ELEMENTS.SC_DISPLAY:
        case ELEMENTS.SC_IF:       processVisualRuntime(node, ctx); break;
    }
}

function walkTree(
    siblings: ScElementNode[],
    parentNode: ScParentNode | undefined,
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
    tree: ScElementNode[],
    nodes: Map<string, ScElementNode>,
    persistedEntries: Record<string, RuntimeValueEntry>,
): {tree: ScElementNode[]; entries: Record<string, RuntimeValueEntry>; pluginRuntime: NodeRuntime} {
    const entries = new Map<string, RuntimeValueEntry>();

    walkTree(tree, undefined, {boxId, entries, persistedEntries, nodes});

    // Create runtime entries for the plugin node itself
    const pluginNode = {type: 'sc-plugin', id: boxId, children: tree, runtime: {run: '', controls: {}}} as ScPluginNode;
    const pluginCtx: RuntimeContext = {boxId, entries, persistedEntries, nodes, scope: tree};
    const pluginRuntime = processPluginRuntime(pluginNode, pluginCtx);

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of entries) {
        values[id] = entry;
    }

    return {tree, entries: values, pluginRuntime};
}
