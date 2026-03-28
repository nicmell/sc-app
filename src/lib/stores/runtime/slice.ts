import type {RuntimeState} from "@/types/stores";
import type {ScElementNode} from "@/types/parsers";
import {isParent, isNode} from "@/lib/utils/guards";
import {combineReducers, createSlice, type CaseReducer} from "@/lib/stores/utils";
import {SliceName, RuntimeAction} from "@/constants/store";
import layout from "../layout";

function propagateControl(state: RuntimeState, nodeId: string, name: string, value: number) {
    const target = state.nodes[nodeId];
    if (!target || !isParent(target)) return;

    function walk(node: ScElementNode) {
        if (isNode(node) && name in node.runtime.controls) {
            node.runtime.controls[name] = value;
        }
        if (isParent(node)) {
            for (const child of node.children) {
                walk(child);
            }
        }
    }

    for (const child of target.children) {
        walk(child);
    }
}

const initialState: RuntimeState = {
  layout: layout.getInitialState(),
  nodes: {},
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; nodes: Record<string, ScElementNode> } }) => {
      Object.assign(state.nodes, action.payload.nodes);
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
        propagateControl(state, nodeId, name, value);
      }
    },
    [RuntimeAction.SET_RUNNING]: (state, action: { payload: { nodeId: string; value: number } }) => {
      const {nodeId, value} = action.payload;
      const node = state.nodes[nodeId];
      if (node && isNode(node)) {
        node.runtime.run = value;
      }
    },
  },
  defaultReducer: combineReducers({
    layout: layout.reducer,
  }) as unknown as CaseReducer<RuntimeState>,
});
