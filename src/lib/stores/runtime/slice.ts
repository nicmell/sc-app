import type {RuntimeState} from "@/types/stores";
import type {ScElementNode} from "@/types/parsers";
import {isParent, isNode} from "@/lib/utils/guards";
import {combineReducers, createSlice, type CaseReducer} from "@/lib/stores/utils";
import {SliceName, RuntimeAction} from "@/constants/store";
import layout from "../layout";

function syncToTree(state: RuntimeState, id: string) {
    const node = state.nodes[id];
    if (!node) return;
    const pid = node.runtime.parentId;
    if (!pid) return;
    const parent = state.nodes[pid];
    if (!parent || !isParent(parent)) return;
    const idx = parent.children.findIndex(c => c.id === id);
    if (idx !== -1) {
        parent.children[idx] = node;
    }
}

function propagateControl(state: RuntimeState, targetId: string, name: string, value: number) {
    for (const [id, node] of Object.entries(state.nodes)) {
        if (!isNode(node) || !(name in node.runtime.controls)) continue;
        // Walk up parentId chain to check if descendant of targetId
        let pid = node.runtime.parentId;
        while (pid) {
            if (pid === targetId) {
                node.runtime.controls[name] = value;
                syncToTree(state, id);
                break;
            }
            const parent = state.nodes[pid];
            if (!parent) break;
            pid = parent.runtime.parentId;
        }
    }
}

const initialState: RuntimeState = {
  layout: layout.getInitialState(),
  nodes: {},
  overrides: [],
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; nodes: Map<string, ScElementNode> } }) => {
      for (const [id, node] of action.payload.nodes) {
        state.nodes[id] = node;
      }
    },
    [RuntimeAction.UNLOAD_PLUGIN]: (state, action: { payload: string }) => {
      for (const [id, node] of Object.entries(state.nodes)) {
        if (node.runtime.rootId === action.payload) {
          delete state.nodes[id];
        }
      }
    },
    [RuntimeAction.SET_CONTROL]: (state, action: { payload: { nodeId: string; name: string; value: number } }) => {
      const {nodeId, name, value} = action.payload;
      const node = state.nodes[nodeId];
      if (node && isNode(node)) {
        node.runtime.controls[name] = value;
        syncToTree(state, nodeId);
        propagateControl(state, nodeId, name, value);
      }
    },
    [RuntimeAction.SET_RUNNING]: (state, action: { payload: { nodeId: string; value: number } }) => {
      const {nodeId, value} = action.payload;
      const node = state.nodes[nodeId];
      if (node && isNode(node)) {
        node.runtime.run = value;
        syncToTree(state, nodeId);
      }
    },
    [RuntimeAction.NEW_GROUP]: (state, action: { payload: { id: string; nodeId: number } }) => {
      const node = state.nodes[action.payload.id];
      if (node && isNode(node)) {
        node.runtime.loaded = true;
        node.runtime.nodeId = action.payload.nodeId;
        syncToTree(state, action.payload.id);
      }
    },
    [RuntimeAction.NEW_SYNTH]: (state, action: { payload: { id: string; nodeId: number } }) => {
      const node = state.nodes[action.payload.id];
      if (node && isNode(node)) {
        node.runtime.loaded = true;
        node.runtime.nodeId = action.payload.nodeId;
        syncToTree(state, action.payload.id);
      }
    },
    [RuntimeAction.FREE_GROUP]: (state, action: { payload: { id: string } }) => {
      const node = state.nodes[action.payload.id];
      if (node && isNode(node)) {
        node.runtime.loaded = false;
        node.runtime.nodeId = 0;
        syncToTree(state, action.payload.id);
      }
    },
    [RuntimeAction.FREE_SYNTH]: (state, action: { payload: { id: string } }) => {
      const node = state.nodes[action.payload.id];
      if (node && isNode(node)) {
        node.runtime.loaded = false;
        node.runtime.nodeId = 0;
        syncToTree(state, action.payload.id);
      }
    },
  },
  defaultReducer: combineReducers({
    layout: layout.reducer,
  }) as unknown as CaseReducer<RuntimeState>,
});
