import type {LayoutState, BoxItem} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, LayoutAction} from "@/constants/store";
import {DEFAULT_LAYOUT} from "@/constants/layout.ts";

const initialState: LayoutState = DEFAULT_LAYOUT;

export const layoutSlice = createSlice({
  name: SliceName.LAYOUT,
  initialState,
  reducers: {
    [LayoutAction.SET_LAYOUT]: (state, action: { payload: BoxItem[] }) => {
      state.length = 0;
      state.push(...action.payload);
    },
    [LayoutAction.RESET_LAYOUT]: (state) => {
      state.length = 0;
      state.push(...DEFAULT_LAYOUT);
    },
    [LayoutAction.REMOVE_BOX]: (state, action: { payload: string }) => {
      const idx = state.findIndex(item => item.i === action.payload);
      if (idx >= 0) state.splice(idx, 1);
    },
    [LayoutAction.ADD_BOX]: (state, action: { payload: BoxItem }) => {
      state.push(action.payload);
    },
    [LayoutAction.SET_BOX_PLUGIN]: (state, action: { payload: { id: string; plugin?: string } }) => {
      const box = state.find(item => item.i === action.payload.id);
      if (box) {
        box.plugin = action.payload.plugin;
      }
    },
  },
});
