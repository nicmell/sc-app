import scsynth from "@/lib/stores/scsynth/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";
import {NodesState} from "@/types/stores";
import {getChildren, isGroup, isSynth} from "@/lib/stores/nodes/slice.ts";

const createNodesSelector: SliceSelector<typeof scsynth.nodes> = (fn) =>
    createSelector(scsynth.nodes, fn);


function getState(state: NodesState, nodeId: number): Record<string, any> {
    const node = state.items.find(n => n.nodeId === nodeId);
    if (!node) {
        return {};
    }
    if (isSynth(node)) {
        return node.controls
    }
    if (isGroup(node)) {
        return getChildren(state.items, node.nodeId)
            .reduce<Record<string, any>>((acc, n) => ({
                ...acc,
                [n.id]: getState(state, n.nodeId)
            }), {});
    }
    return {};
}

export default {
    items: createNodesSelector(s => s.items),
    state: (nodeId: number) => createNodesSelector((state) => getState(state, nodeId))
};
