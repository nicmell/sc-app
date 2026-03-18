import type {RuntimeState} from "@/types/stores";
import type {ScElementNode, NodeRuntime, RuntimeValueEntry} from "@/lib/parsers";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, RuntimeAction} from "@/constants/store";

const initialState: RuntimeState = {
  items: [],
  values: {},
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; loaded: boolean; error?: string; title?: string; elements?: ScElementNode[]; values?: Record<string, RuntimeValueEntry>; runtime?: NodeRuntime } }) => {
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

      const runtime = action.payload.runtime ?? { run: '', controls: {} };
      const existing = state.items.find(item => item.id === action.payload.id);
      if (existing) {
        existing.loaded = action.payload.loaded;
        existing.error = action.payload.error;
        existing.title = action.payload.title;
        existing.children = action.payload.elements ?? [];
        existing.runtime = runtime;
      } else {
        state.items.push({
          type: 'sc-plugin',
          id: action.payload.id,
          loaded: action.payload.loaded,
          error: action.payload.error,
          title: action.payload.title,
          children: action.payload.elements ?? [],
          runtime,
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
