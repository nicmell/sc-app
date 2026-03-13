import type {LayoutState, LayoutOptions, BoxItem} from "@/types/stores";
import type {ScElementNode} from "@/lib/parsers";
import {findElementByPath, setControls, setRunning, syncInputValues, syncRunValues} from "@/lib/parsers";
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
    [LayoutAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; loaded: boolean; error?: string; title?: string; elements?: ScElementNode[] } }) => {
      const box = state.items.find(item => item.i === action.payload.id);
      if (box) {
        box.loaded = action.payload.loaded;
        box.error = action.payload.error;
        box.title = action.payload.title;
        box.elements = action.payload.elements;
      }
    },
    [LayoutAction.UNLOAD_PLUGIN]: (state, action: { payload: string }) => {
      const box = state.items.find(item => item.i === action.payload);
      if (box) {
        delete box.plugin;
        delete box.loaded;
        delete box.error;
        delete box.title;
      }
    },
    [LayoutAction.SET_CONTROL]: (state, action: { payload: { boxId: string; path: string[]; controls: Record<string, number> } }) => {
      const box = state.items.find(item => item.i === action.payload.boxId);
      if (!box?.elements) return;
      const el = findElementByPath(box.elements, action.payload.path);
      if (el) {
        setControls(el, action.payload.controls);
        syncInputValues(box.elements);
      }
    },
    [LayoutAction.SET_RUNNING]: (state, action: { payload: { boxId: string; path: string[]; isRunning: boolean } }) => {
      const box = state.items.find(item => item.i === action.payload.boxId);
      if (!box?.elements) return;
      const el = findElementByPath(box.elements, action.payload.path);
      if (el) {
        setRunning(el, action.payload.isRunning);
        syncRunValues(box.elements);
      }
    },
  },
});
