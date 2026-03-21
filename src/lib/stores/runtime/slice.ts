import type {RuntimeState} from "@/types/stores";
import type {ScElementNode, PluginRuntime, RuntimeValueEntry} from "@/types/parsers";
import {findElementById} from "@/lib/utils/elementTree";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, RuntimeAction} from "@/constants/store";

function propagateGroupControl(
    values: Record<string, RuntimeValueEntry>,
    children: ScElementNode[],
    controlName: string,
    value: number,
): void {
    for (const child of children) {
        if ((child.type === 'sc-synth' || child.type === 'sc-group') && child.runtime.controls[controlName]) {
            const entry = values[child.runtime.controls[controlName]];
            if (entry?.type === 'control') {
                entry.value = value;
            }
        }
        if (child.type === 'sc-group') {
            propagateGroupControl(values, child.children, controlName, value);
        }
    }
}

const initialState: RuntimeState = {
  items: [],
  values: {},
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; elements?: ScElementNode[]; values?: Record<string, RuntimeValueEntry>; runtime: PluginRuntime } }) => {
      // Delete old entries for this boxId
      for (const key of Object.keys(state.values)) {
        if (state.values[key].boxId === action.payload.id) {
          delete state.values[key];
        }
      }
      // Add new entries
      if (action.payload.values) {
        Object.assign(state.values, action.payload.values);
      }

      const existing = state.items.find(item => item.id === action.payload.id);
      if (existing) {
        existing.children = action.payload.elements ?? [];
        existing.runtime = action.payload.runtime;
      } else {
        state.items.push({
          type: 'sc-plugin',
          id: action.payload.id,
          children: action.payload.elements ?? [],
          runtime: action.payload.runtime,
        });
      }
    },
    [RuntimeAction.UNLOAD_PLUGIN]: (state, action: { payload: string }) => {
      state.items = state.items.filter(item => item.id !== action.payload);
      // Delete all entries for this boxId
      for (const key of Object.keys(state.values)) {
        if (state.values[key].boxId === action.payload) {
          delete state.values[key];
        }
      }
    },
    [RuntimeAction.SET_CONTROL]: (state, action: { payload: { entryId: string; value: number } }) => {
      const entry = state.values[action.payload.entryId];
      if (entry && entry.type === 'control') {
        entry.value = action.payload.value;
        // Propagate to children if target is a group
        const plugin = state.items.find(p => p.id === entry.boxId);
        if (plugin) {
          const target = findElementById(plugin.children, entry.targetNode);
          if (target?.type === 'sc-group') {
            propagateGroupControl(state.values, target.children, entry.name, action.payload.value);
          }
        }
      }
    },
    [RuntimeAction.SET_RUNNING]: (state, action: { payload: { entryId: string; value: number } }) => {
      const entry = state.values[action.payload.entryId];
      if (entry && entry.type === 'run') {
        entry.value = action.payload.value;
      }
    },
  },
});
