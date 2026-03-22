import type {ScElementNode, ScParentNode, ScPluginNode, PluginRuntime, RuntimeValueEntry} from "@/types/parsers";
import {isParent} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";
import {
    type RuntimeContext,
    processPluginRuntime, processGroupRuntime, processSynthRuntime, processSynthDefRuntime,
    processUgenRuntime, processControlRuntime, processRunRuntime, processVisualRuntime,
} from "./handlers";

function dispatchRuntime(node: ScElementNode, ctx: RuntimeContext): ScElementNode["runtime"] {
    switch (node.type) {
        case ELEMENTS.SC_GROUP:    return processGroupRuntime(node, ctx);
        case ELEMENTS.SC_SYNTH:    return processSynthRuntime(node, ctx);
        case ELEMENTS.SC_SYNTHDEF: return processSynthDefRuntime(node, ctx);
        case ELEMENTS.SC_UGEN:     return processUgenRuntime(node, ctx);
        case ELEMENTS.SC_RANGE:
        case ELEMENTS.SC_CHECKBOX: return processControlRuntime(node, ctx);
        case ELEMENTS.SC_RUN:      return processRunRuntime(node, ctx);
        case ELEMENTS.SC_DISPLAY:
        case ELEMENTS.SC_IF:       return processVisualRuntime(node, ctx);
        default: throw new Error(`Unknown element type: ${node.type}`);
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
        node.runtime = dispatchRuntime(node, levelCtx);
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
    const pluginCtx: RuntimeContext = {boxId, entries, persistedEntries, nodes, scope: tree};
    const pluginRuntime = processPluginRuntime(pluginNode, pluginCtx);

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of entries) {
        values[id] = entry;
    }

    return {tree, entries: values, pluginRuntime};
}
