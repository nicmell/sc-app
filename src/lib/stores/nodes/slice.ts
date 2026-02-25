import type {NodesState, NodeItem, SynthItem, GroupItem} from "@/types/stores";
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

function removeControlsForIds(controls: Record<string, number>, ids: Set<string>) {
  for (const key of Object.keys(controls)) {
    const dotIdx = key.indexOf('.');
    if (dotIdx !== -1 && ids.has(key.slice(0, dotIdx))) {
      delete controls[key];
    }
  }
}

const initialState: NodesState = {
  items: [],
  controls: {},
};

export const nodesSlice = createSlice({
  name: SliceName.NODES,
  initialState,
  reducers: {
    [NodesAction.NEW_SYNTH]: (state, action: { payload: { id: string; nodeId: number; groupId: number; params: Record<string, number> } }) => {
      state.items.push({type: 'synth', id: action.payload.id, nodeId: action.payload.nodeId, groupId: action.payload.groupId, isRunning: false});
      for (const [key, value] of Object.entries(action.payload.params)) {
        state.controls[`${action.payload.id}.${key}`] = value;
      }
    },
    [NodesAction.NEW_GROUP]: (state, action: { payload: { id: string; nodeId: number; groupId: number } }) => {
      state.items.push({type: 'group', id: action.payload.id, nodeId: action.payload.nodeId, groupId: action.payload.groupId});
    },
    [NodesAction.FREE_NODE]: (state, action: { payload: number }) => {
      const node = state.items.find(n => n.nodeId === action.payload);
      if (!node) return;
      if (isGroup(node)) {
        const descendants = getDescendants(state.items, node.nodeId);
        const nodeIds = new Set(descendants.map(n => n.nodeId));
        nodeIds.add(node.nodeId);
        const ids = new Set(descendants.filter(isSynth).map(n => n.id));
        removeControlsForIds(state.controls, ids);
        state.items = state.items.filter(n => !nodeIds.has(n.nodeId));
      } else {
        removeControlsForIds(state.controls, new Set([node.id]));
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
    [NodesAction.SET_CONTROL]: (state, action: { payload: { nodeId: number; params: Record<string, number> } }) => {
      const node = state.items.find(n => n.nodeId === action.payload.nodeId);
      if (!node) return;
      if (isSynth(node)) {
        for (const [key, value] of Object.entries(action.payload.params)) {
          state.controls[`${node.id}.${key}`] = value;
        }
      } else if (isGroup(node)) {
        const keys = Object.keys(action.payload.params);
        for (const synth of getLeaves(state.items, node.nodeId)) {
          for (const key of keys) {
            const controlKey = `${synth.id}.${key}`;
            if (controlKey in state.controls) {
              state.controls[controlKey] = action.payload.params[key];
            }
          }
        }
      }
    },
  },
});
