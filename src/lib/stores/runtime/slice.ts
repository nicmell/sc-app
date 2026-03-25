import type {RuntimeState} from "@/types/stores";
import type {ScElementNode, RuntimeValueEntry} from "@/types/parsers";
import {isParent, isControlEntry, isRunEntry} from "@/lib/utils/guards";
import {combineReducers, createSlice, type CaseReducer} from "@/lib/stores/utils";
import {SliceName, RuntimeAction} from "@/constants/store";
import layout from "../layout";

function collectEntries(
    state: RuntimeState,
    nodeId: string,
): Map<string, RuntimeValueEntry> {
    const result = new Map<string, RuntimeValueEntry>();
    const target = state.nodes[nodeId];
    if (!target) return result;

    function addEntry(id: string) {
        if (id && id in state.entries) {
            result.set(id, state.entries[id])
        }
    }

    function walk(node: ScElementNode) {
        const rt = node.runtime;
        if ('run' in rt) addEntry(rt.run)
        if ('value' in rt) addEntry(rt.value)
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

const initialState: RuntimeState = {
  layout: layout.getInitialState(),
  nodes: {},
  entries: {},
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; nodes: Record<string, ScElementNode>; entries?: Record<string, RuntimeValueEntry> } }) => {
      Object.assign(state.nodes, action.payload.nodes);
      if (action.payload.entries) {
        Object.assign(state.entries, action.payload.entries);
      }
    },
    [RuntimeAction.UNLOAD_PLUGIN]: (state, action: { payload: string }) => {
      for (const [id, node] of Object.entries(state.nodes)) {
        if (node.runtime.rootId === action.payload) {
          delete state.nodes[id];
        }
      }
      // Clean up entries for this rootId
      for (const [id, entry] of Object.entries(state.entries)) {
        if (entry.rootId === action.payload) {
          delete state.entries[id];
        }
      }
    },
    [RuntimeAction.SET_CONTROL]: (state, action: { payload: { entryId: string; value: number } }) => {
      const entry = state.entries[action.payload.entryId];
      if (entry && isControlEntry(entry)) {
        entry.value = action.payload.value;
        // Propagate to children if target is a parent node
        for (const [id, e] of collectEntries(state, entry.targetNode)) {
          if (isControlEntry(e) && e.name === entry.name && id !== action.payload.entryId) {
            e.value = action.payload.value;
          }
        }
      }
    },
    [RuntimeAction.SET_RUNNING]: (state, action: { payload: { entryId: string; value: number } }) => {
      const entry = state.entries[action.payload.entryId];
      if (entry && isRunEntry(entry)) {
        entry.value = action.payload.value;
      }
    },
  },
  defaultReducer: combineReducers({
    layout: layout.reducer,
  }) as unknown as CaseReducer<RuntimeState>,
});
