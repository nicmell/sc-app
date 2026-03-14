import type {LayoutState, LayoutOptions, BoxItem} from "@/types/stores";
import type {ScElementNode, RuntimeEntry} from "@/lib/parsers";
import {isInput, isRun, findElementById, findElementByPath, setControls, isNode} from "@/lib/parsers";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, LayoutAction} from "@/constants/store";
import {DEFAULT_LAYOUT, DEFAULT_OPTIONS} from "@/constants/layout.ts";

const initialState: LayoutState = {
  items: DEFAULT_LAYOUT,
  options: DEFAULT_OPTIONS,
};

export const layoutSlice = createSlice({
  name: SliceName.LAYOUT,
  initialState,
  reducers: {
    [LayoutAction.SET_LAYOUT]: (state, action: { payload: BoxItem[] }) => {
      state.items = action.payload;
    },
    [LayoutAction.RESET_LAYOUT]: (state) => {
      state.items = DEFAULT_LAYOUT;
    },
    [LayoutAction.REMOVE_BOX]: (state, action: { payload: string }) => {
      state.items = state.items.filter(item => item.i !== action.payload);
    },
    [LayoutAction.ADD_BOX]: (state, action: { payload: BoxItem }) => {
      const item = action.payload;
      state.items = [...state.items, item];
    },
    [LayoutAction.SET_OPTIONS]: (state, action: { payload: Partial<LayoutOptions> }) => {
      state.options = {...state.options, ...action.payload};
    },
    [LayoutAction.SET_BOX_PLUGIN]: (state, action: { payload: { id: string; plugin?: string } }) => {
      const box = state.items.find(item => item.i === action.payload.id);
      if (box) {
        box.plugin = action.payload.plugin;
      }
    },
    [LayoutAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; loaded: boolean; error?: string; title?: string; elements?: ScElementNode[]; runtime?: RuntimeEntry[] } }) => {
      const box = state.items.find(item => item.i === action.payload.id);
      if (box) {
        box.loaded = action.payload.loaded;
        box.error = action.payload.error;
        box.title = action.payload.title;
        box.elements = action.payload.elements;
        box.runtime = action.payload.runtime;
      }
    },
    [LayoutAction.UNLOAD_PLUGIN]: (state, action: { payload: string }) => {
      const box = state.items.find(item => item.i === action.payload);
      if (box) {
        delete box.plugin;
        delete box.loaded;
        delete box.error;
        delete box.title;
        delete box.runtime;
      }
    },
    [LayoutAction.SET_CONTROL]: (state, action: { payload: { boxId: string; elementId: string; value: number } }) => {
      const box = state.items.find(item => item.i === action.payload.boxId);
      if (!box?.elements || !box?.runtime) return;
      const input = findElementById(box.elements, action.payload.elementId);
      if (!input || !isInput(input)) return;
      const entryId = input.runtime.value;
      const entry = box.runtime.find(e => e.id === entryId);
      if (!entry) return;
      entry.value = action.payload.value;

      // If target is a group, fan out to descendant synths
      const segments = input.bind.split('.');
      const path = segments.slice(0, -1);
      const control = segments[segments.length - 1];
      const target = findElementByPath(box.elements, path);
      if (target && isNode(target)) {
        // setControls handles group fan-out to children
        setControls(target, box.runtime, {[control]: action.payload.value});
      }
    },
    [LayoutAction.SET_RUNNING]: (state, action: { payload: { boxId: string; elementId: string; value: number } }) => {
      const box = state.items.find(item => item.i === action.payload.boxId);
      if (!box?.elements || !box?.runtime) return;
      const el = findElementById(box.elements, action.payload.elementId);
      if (!el || !isRun(el)) return;
      const entryId = el.runtime.value;
      const entry = box.runtime.find(e => e.id === entryId);
      if (entry) entry.value = action.payload.value;
    },
  },
});
