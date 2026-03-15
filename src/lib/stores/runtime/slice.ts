import type {RuntimeEntry, RuntimeState} from "@/types/stores";
import type {ScElementNode, ScPluginNode} from "@/lib/parsers/types";
import {isInput, isRun, isNode, isGroup, isSynth} from "@/lib/parsers/guards";
import {findElementById, findElementByPath} from "@/lib/parsers/elementTree";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, RuntimeAction} from "@/constants/store";

function mergeRuntime(defaults: RuntimeEntry[], existing: RuntimeEntry[]): RuntimeEntry[] {
  const existingById = new Map<string, RuntimeEntry>();
  for (const entry of existing) {
    existingById.set(entry.id, entry);
  }
  return defaults.map(def => {
    const prev = existingById.get(def.id);
    return prev ? {...def, value: prev.value} : def;
  });
}

function setControls(element: ScElementNode, runtime: RuntimeEntry[], controls: Record<string, number>): void {
  if (isSynth(element)) {
    for (const [name, value] of Object.entries(controls)) {
      const entryId = element.runtime.controls[name];
      if (entryId) {
        const entry = runtime.find(e => e.id === entryId);
        if (entry) entry.value = value;
      }
    }
  } else if (isGroup(element)) {
    for (const [name, value] of Object.entries(controls)) {
      const entryId = element.runtime.controls[name];
      if (entryId) {
        const entry = runtime.find(e => e.id === entryId);
        if (entry) entry.value = value;
      }
    }
    for (const child of element.children) {
      setControls(child, runtime, controls);
    }
  }
}

const initialState: RuntimeState = {
  entries: [],
  elements: [],
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_PLUGIN]: (state, action: { payload: ScPluginNode }) => {
      const plugin = action.payload;
      const idx = state.elements.findIndex(p => p.id === plugin.id);
      if (idx >= 0) {
        state.elements[idx] = plugin;
      } else {
        state.elements.push(plugin);
      }
      if (plugin.runtime.entries.length > 0) {
        const merged = mergeRuntime(plugin.runtime.entries, state.entries);
        state.entries = state.entries.filter(e => e.boxId !== plugin.id).concat(merged);
      }
    },
    [RuntimeAction.UNLOAD_PLUGIN]: (state, action: { payload: string }) => {
      const boxId = action.payload;
      state.elements = state.elements.filter(p => p.id !== boxId);
      state.entries = state.entries.filter(e => e.boxId !== boxId);
    },
    [RuntimeAction.SET_CONTROL]: (state, action: { payload: { boxId: string; elementId: string; value: number } }) => {
      const plugin = state.elements.find(p => p.id === action.payload.boxId);
      if (!plugin) return;
      const input = findElementById(plugin.runtime.children, action.payload.elementId);
      if (!input || !isInput(input)) return;
      const entryId = input.runtime.value;
      const entry = state.entries.find(e => e.id === entryId);
      if (!entry) return;
      entry.value = action.payload.value;

      // If target is a group, fan out to descendant synths
      const segments = input.bind.split('.');
      const path = segments.slice(0, -1);
      const control = segments[segments.length - 1];
      const target = findElementByPath(plugin.runtime.children, path);
      if (target && isNode(target)) {
        setControls(target, state.entries, {[control]: action.payload.value});
      }
    },
    [RuntimeAction.SET_RUNNING]: (state, action: { payload: { boxId: string; elementId: string; value: number } }) => {
      const plugin = state.elements.find(p => p.id === action.payload.boxId);
      if (!plugin) return;
      const el = findElementById(plugin.runtime.children, action.payload.elementId);
      if (!el || !isRun(el)) return;
      const entryId = el.runtime.value;
      const entry = state.entries.find(e => e.id === entryId);
      if (entry) entry.value = action.payload.value;
    },
  },
});
