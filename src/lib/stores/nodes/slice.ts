import type {
  AnyElement,
  GroupElement,
  InputElement,
  NodeElement,
  NodesState,
  SynthElement,
  UGenElement
} from "@/types/stores";
import type {ScElement, ScUGenData} from "@/sc-elements/context";
import {createSlice} from "@/lib/stores/utils";
import {NodesAction, SliceName} from "@/constants/store";

export function isSynth(node: NodeElement): node is SynthElement {
  return node.type === 'synth';
}

export function isGroup(node: NodeElement): node is GroupElement {
  return node.type === 'group';
}

export function isInput(el: AnyElement): el is InputElement {
  return el.type === 'input';
}

export function isUGen(el: AnyElement): el is UGenElement {
  return el.type === 'ugen';
}

export function isNodeElement(el: AnyElement): el is NodeElement {
  return el.type === 'synth' || el.type === 'group';
}

export function isScUGenData(el: ScElement): el is ScElement & ScUGenData {
  return 'rate' in el && 'id' in el;
}

export function isScNode(el: ScElement): boolean {
  return 'nodeId' in el;
}

function getChildren(items: NodeElement[], groupId: number): NodeElement[] {
  return items.filter(n => n.groupId === groupId);
}

function getDescendants(items: NodeElement[], groupId: number): NodeElement[] {
  const result: NodeElement[] = [];
  for (const child of getChildren(items, groupId)) {
    result.push(child);
    if (isGroup(child)) {
      result.push(...getDescendants(items, child.nodeId));
    }
  }
  return result;
}

function getLeaves(items: NodeElement[], groupId: number): SynthElement[] {
  return getDescendants(items, groupId).filter(isSynth);
}

const initialState: NodesState = {
  items: [],
};

export const nodesSlice = createSlice({
  name: SliceName.NODES,
  initialState,
  reducers: {
    [NodesAction.NEW_SYNTH]: (state, action: {
      payload: { nodeId: number; groupId: number; elements: AnyElement[] }
    }) => {
      const {nodeId, groupId, elements} = action.payload;
      const id = `synth_${nodeId}`;
      const item: SynthElement = {id, type: 'synth', nodeId, groupId, isRunning: false, elements};
      state.items.push(item);
      const parent = state.items.find(n => n.nodeId === groupId);
      if (parent) {
        parent.elements.push(item);
      }
    },
    [NodesAction.NEW_GROUP]: (state, action: { payload: { nodeId: number; groupId: number } }) => {
      const {nodeId, groupId} = action.payload;
      const id = `group_${nodeId}`;
      const item: GroupElement = {id, type: 'group', nodeId, groupId, elements: []};
      state.items.push(item);
      const parent = state.items.find(n => n.nodeId === groupId);
      if (parent) {
        parent.elements.push(item);
      }
    },
    [NodesAction.FREE_NODE]: (state, action: { payload: number }) => {
      const node = state.items.find(n => n.nodeId === action.payload);
      if (!node) return;
      const freedIds: Set<number> = new Set();
      if (isGroup(node)) {
        freedIds.add(node.nodeId);
        for (const d of getDescendants(state.items, node.nodeId)) {
          freedIds.add(d.nodeId);
        }
        state.items = state.items.filter(n => !freedIds.has(n.nodeId));
      } else {
        freedIds.add(action.payload);
        state.items = state.items.filter(n => n.nodeId !== action.payload);
      }
      for (const item of state.items) {
        item.elements = item.elements.filter(el => !isNodeElement(el) || !freedIds.has(el.nodeId));
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
        for (const el of node.elements) {
          if (isInput(el) && el.id in action.payload.inputs) {
            el.value = action.payload.inputs[el.id];
          }
        }
      } else if (isGroup(node)) {
        const keys = Object.keys(action.payload.inputs);
        for (const synth of getLeaves(state.items, node.nodeId)) {
          for (const key of keys) {
            const el = synth.elements.filter(isInput).find(e => e.id === key);
            if (el) {
              el.value = action.payload.inputs[key];
            }
          }
        }
      }
    },
  },
});
