import type {ScElementNode} from "@/types/parsers";
import type {RuntimeState, ConfigFile} from "@/types/stores";
import {isParent, isPlugin} from "@/lib/utils/guards";

type PersistedRuntime = ConfigFile['runtime'];

export function marshalTree(state: RuntimeState): PersistedRuntime {
    const tree = Object.values(state.nodes)
        .filter(isPlugin)
        .map(item => ({...item, runtime: {...item.runtime, loaded: false, error: undefined}}));
    return {
        layout: state.layout,
        tree,
    };
}

export function unmarshalTree(persisted: PersistedRuntime): RuntimeState {
    const nodes: Record<string, ScElementNode> = {};

    function walk(node: ScElementNode) {
        nodes[node.id] = node;
        if (isParent(node)) {
            for (const child of node.children) {
                walk(child);
            }
        }
    }

    for (const plugin of persisted.tree) {
        walk(plugin);
    }
    return {
        layout: persisted.layout,
        nodes,
    };
}
