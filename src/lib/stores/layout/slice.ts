import type {LayoutState, BoxItem} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, LayoutAction} from "@/constants/store";
import {DEFAULT_LAYOUT} from "@/constants/layout.ts";

const initialState: LayoutState = {
  items: DEFAULT_LAYOUT,
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
    [LayoutAction.SET_BOX_PLUGIN]: (state, action: { payload: { id: string; plugin?: string } }) => {
      const box = state.items.find(item => item.i === action.payload.id);
      if (box) {
        box.plugin = action.payload.plugin;
      }
    },
  },
});
