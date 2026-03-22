import type {RuntimeState} from "@/types/stores";
import type {ScElementNode, PluginRuntime, RuntimeValueEntry} from "@/types/parsers";
import {findElementById} from "@/lib/utils/elementTree";
import {isParent} from "@/lib/utils/guards";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, RuntimeAction} from "@/constants/store";

function collectEntries(
    state: RuntimeState,
    nodeId: string,
): Map<string, RuntimeValueEntry> {
    const result = new Map<string, RuntimeValueEntry>();
    const target = findElementById(state.tree, nodeId);
    if (!target) return result;

    function addEntry(id: string) {
        if (id && id in state.entries) {
            result.set(id, state.entries[id])
        }
    }

    function walk(node: ScElementNode) {
        const rt = node.runtime;
        if ('run' in rt) {
            addEntry(rt.run)
        }
        if ('value' in rt) {
            addEntry(rt.value)
        }
        if ('controls' in rt) {
            for (const id of Object.values(rt.controls)) {
                addEntry(id)
            }
        }
        if (isParent(node)) {
            for (const child of node.children) {
                walk(child)
            }
        }
    }

    walk(target);
    return result;
}

function cleanupEntries(state: RuntimeState) {
    const referenced = new Set<string>();
    for (const plugin of state.tree) {
        for (const id of collectEntries(state, plugin.id).keys()) {
            referenced.add(id);
        }
    }
    for (const id of Object.keys(state.entries)) {
        if (!referenced.has(id)) {
            delete state.entries[id];
        }
    }
}

const initialState: RuntimeState = {
  tree: [],
  entries: {},
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; elements?: ScElementNode[]; entries?: Record<string, RuntimeValueEntry>; runtime: PluginRuntime } }) => {
      state.tree = state.tree.filter(item => item.id !== action.payload.id);
      state.tree.push({type: 'sc-plugin', id: action.payload.id, children: action.payload.elements ?? [], runtime: action.payload.runtime});
      if (action.payload.entries) {
        Object.assign(state.entries, action.payload.entries);
      }
      cleanupEntries(state);
    },
    [RuntimeAction.UNLOAD_PLUGIN]: (state, action: { payload: string }) => {
      state.tree = state.tree.filter(item => item.id !== action.payload);
      cleanupEntries(state);
    },
    [RuntimeAction.SET_CONTROL]: (state, action: { payload: { entryId: string; value: number } }) => {
      const entry = state.entries[action.payload.entryId];
      if (entry && entry.type === 'control') {
        entry.value = action.payload.value;
        // Propagate to children if target is a parent node
        for (const [id, e] of collectEntries(state, entry.targetNode)) {
          if (e.type === 'control' && e.name === entry.name && id !== action.payload.entryId) {
            e.value = action.payload.value;
          }
        }
      }
    },
    [RuntimeAction.SET_RUNNING]: (state, action: { payload: { entryId: string; value: number } }) => {
      const entry = state.entries[action.payload.entryId];
      if (entry && entry.type === 'run') {
        entry.value = action.payload.value;
      }
    },
  },
});
