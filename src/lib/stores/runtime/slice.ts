import type {RuntimeState} from "@/types/stores";
import type {ScElementNode} from "@/lib/parsers/types";
import type {RuntimeEntry} from "@/lib/runtime/types";
import {isInput, isRun, isNode} from "@/lib/parsers/guards";
import {findElementById, findElementByPath} from "@/lib/parsers/elementTree";
import {setControls} from "@/lib/runtime";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, RuntimeAction} from "@/constants/store";

const initialState: RuntimeState = {
  entries: [],
  layout: {},
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; loaded: boolean; error?: string; title?: string; elements?: ScElementNode[]; entries?: RuntimeEntry[] } }) => {
      const {id, loaded, error, title, elements, entries} = action.payload;
      state.layout[id] = {loaded, error, title, elements};
      if (entries) {
        state.entries = state.entries.filter(e => e.boxId !== id).concat(entries);
      }
    },
    [RuntimeAction.UNLOAD_PLUGIN]: (state, action: { payload: string }) => {
      const boxId = action.payload;
      delete state.layout[boxId];
      state.entries = state.entries.filter(e => e.boxId !== boxId);
    },
    [RuntimeAction.SET_CONTROL]: (state, action: { payload: { boxId: string; elementId: string; value: number } }) => {
      const elements = state.layout[action.payload.boxId]?.elements;
      if (!elements) return;
      const input = findElementById(elements, action.payload.elementId);
      if (!input || !isInput(input)) return;
      const entryId = input.runtime.value;
      const entry = state.entries.find(e => e.id === entryId);
      if (!entry) return;
      entry.value = action.payload.value;

      // If target is a group, fan out to descendant synths
      const segments = input.bind.split('.');
      const path = segments.slice(0, -1);
      const control = segments[segments.length - 1];
      const target = findElementByPath(elements, path);
      if (target && isNode(target)) {
        setControls(target, state.entries, {[control]: action.payload.value});
      }
    },
    [RuntimeAction.SET_RUNNING]: (state, action: { payload: { boxId: string; elementId: string; value: number } }) => {
      const elements = state.layout[action.payload.boxId]?.elements;
      if (!elements) return;
      const el = findElementById(elements, action.payload.elementId);
      if (!el || !isRun(el)) return;
      const entryId = el.runtime.value;
      const entry = state.entries.find(e => e.id === entryId);
      if (entry) entry.value = action.payload.value;
    },
  },
});
