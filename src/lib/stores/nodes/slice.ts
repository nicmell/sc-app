import type {NodesState, NodeItem, SynthItem, GroupItem, UGenItem} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, NodesAction} from "@/constants/store";

export function isSynth(node: NodeItem): node is SynthItem {
  return node.type === 'synth';
}

export function isGroup(node: NodeItem): node is GroupItem {
  return node.type === 'group';
}

function getChildren(items: NodeItem[], groupId: number): NodeItem[] {
  return items.filter(n => n.groupId === groupId);
}

function getDescendants(items: NodeItem[], groupId: number): NodeItem[] {
  const result: NodeItem[] = [];
  for (const child of getChildren(items, groupId)) {
    result.push(child);
    if (isGroup(child)) {
      result.push(...getDescendants(items, child.nodeId));
    }
  }
  return result;
}

function getLeaves(items: NodeItem[], groupId: number): SynthItem[] {
  return getDescendants(items, groupId).filter(isSynth);
}

const initialState: NodesState = {
  items: [],
};

export const nodesSlice = createSlice({
  name: SliceName.NODES,
  initialState,
  reducers: {
    [NodesAction.NEW_SYNTH]: (state, action: { payload: { nodeId: number; groupId: number; inputs: Record<string, any>; ugens?: UGenItem[] } }) => {
      state.items.push({type: 'synth', nodeId: action.payload.nodeId, groupId: action.payload.groupId, isRunning: false, inputs: action.payload.inputs, ugens: action.payload.ugens ?? []});
    },
    [NodesAction.NEW_GROUP]: (state, action: { payload: { nodeId: number; groupId: number } }) => {
      state.items.push({type: 'group', nodeId: action.payload.nodeId, groupId: action.payload.groupId});
    },
    [NodesAction.FREE_NODE]: (state, action: { payload: number }) => {
      const node = state.items.find(n => n.nodeId === action.payload);
      if (!node) return;
      if (isGroup(node)) {
        const ids = new Set(getDescendants(state.items, node.nodeId).map(n => n.nodeId));
        ids.add(node.nodeId);
        state.items = state.items.filter(n => !ids.has(n.nodeId));
      } else {
        state.items = state.items.filter(n => n.nodeId !== action.payload);
      }
    },
    [NodesAction.SET_RUNNING]: (state, action: { payload: { nodeId: number; isRunning: boolean } }) => {
      const node = state.items.find(n => n.nodeId === action.payload.nodeId);
      if (!node) return;
      if (isSynth(node)) {
        node.isRunning = action.payload.isRunning;
      } else if (isGroup(node)) {
        for (const synth of getLeaves(state.items, node.nodeId)) {
          synth.isRunning = action.payload.isRunning;
        }
      }
    },
    [NodesAction.SET_INPUTS]: (state, action: { payload: { nodeId: number; inputs: Record<string, any> } }) => {
      const node = state.items.find(n => n.nodeId === action.payload.nodeId);
      if (!node) return;
      if (isSynth(node)) {
        Object.assign(node.inputs, action.payload.inputs);
      } else if (isGroup(node)) {
        const keys = Object.keys(action.payload.inputs);
        for (const synth of getLeaves(state.items, node.nodeId)) {
          for (const key of keys) {
            if (key in synth.inputs) synth.inputs[key] = action.payload.inputs[key];
          }
        }
      }
    },
  },
});
