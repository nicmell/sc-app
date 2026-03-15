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
};

export const runtimeSlice = createSlice({
  name: SliceName.RUNTIME,
  initialState,
  reducers: {
    [RuntimeAction.LOAD_ENTRIES]: (state, action: { payload: { entries: RuntimeEntry[] } }) => {
      // Merge: replace entries with matching boxId, add new ones
      const incoming = action.payload.entries;
      if (incoming.length === 0) return;
      const boxId = incoming[0].boxId;
      state.entries = state.entries.filter(e => e.boxId !== boxId).concat(incoming);
    },
    [RuntimeAction.UNLOAD_ENTRIES]: (state, action: { payload: { boxId: string } }) => {
      state.entries = state.entries.filter(e => e.boxId !== action.payload.boxId);
    },
    [RuntimeAction.SET_CONTROL]: (state, action: { payload: { boxId: string; elementId: string; value: number; elements: ScElementNode[] } }) => {
      const {elementId, value, elements} = action.payload;
      const input = findElementById(elements, elementId);
      if (!input || !isInput(input)) return;
      const entryId = input.runtime.value;
      const entry = state.entries.find(e => e.id === entryId);
      if (!entry) return;
      entry.value = value;

      // If target is a group, fan out to descendant synths
      const segments = input.bind.split('.');
      const path = segments.slice(0, -1);
      const control = segments[segments.length - 1];
      const target = findElementByPath(elements, path);
      if (target && isNode(target)) {
        setControls(target, state.entries, {[control]: value});
      }
    },
    [RuntimeAction.SET_RUNNING]: (state, action: { payload: { boxId: string; elementId: string; value: number; elements: ScElementNode[] } }) => {
      const {elementId, elements} = action.payload;
      const el = findElementById(elements, elementId);
      if (!el || !isRun(el)) return;
      const entryId = el.runtime.value;
      const entry = state.entries.find(e => e.id === entryId);
      if (entry) entry.value = action.payload.value;
    },
  },
});
