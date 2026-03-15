import type {RuntimeState} from "@/types/stores";
import type {ScElementNode} from "@/lib/parsers";
import {isInput, isRun, findElementById, findElementByPath, setControls, syncInputValues, syncIsRunning, syncRunValues} from "@/lib/parsers";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, RuntimeAction} from "@/constants/store";

const initialState: RuntimeState = {
  items: [],
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; loaded: boolean; error?: string; title?: string; elements?: ScElementNode[] } }) => {
      const existing = state.items.find(item => item.id === action.payload.id);
      if (existing) {
        existing.loaded = action.payload.loaded;
        existing.error = action.payload.error;
        existing.title = action.payload.title;
        existing.children = action.payload.elements ?? [];
      } else {
        state.items.push({
          type: 'sc-plugin',
          id: action.payload.id,
          loaded: action.payload.loaded,
          error: action.payload.error,
          title: action.payload.title,
          children: action.payload.elements ?? [],
        });
      }
    },
    [RuntimeAction.UNLOAD_PLUGIN]: (state, action: { payload: string }) => {
      state.items = state.items.filter(item => item.id !== action.payload);
    },
    [RuntimeAction.SET_CONTROL]: (state, action: { payload: { boxId: string; elementId: string; value: number } }) => {
      const plugin = state.items.find(item => item.id === action.payload.boxId);
      if (!plugin) return;
      const input = findElementById(plugin.children, action.payload.elementId);
      if (!input || !isInput(input)) return;
      const segments = input.bind.split('.');
      const path = segments.slice(0, -1);
      const control = segments[segments.length - 1];
      const target = findElementByPath(plugin.children, path);
      if (target) {
        input.runtime.value = action.payload.value;
        setControls(target, {[control]: action.payload.value});
        syncInputValues(plugin.children);
      }
    },
    [RuntimeAction.SET_RUNNING]: (state, action: { payload: { boxId: string; elementId: string; value: number } }) => {
      const plugin = state.items.find(item => item.id === action.payload.boxId);
      if (!plugin) return;
      const el = findElementById(plugin.children, action.payload.elementId);
      if (el && isRun(el)) {
        el.runtime.value = action.payload.value;
        syncIsRunning(plugin.children);
        syncRunValues(plugin.children);
      }
    },
  },
});
