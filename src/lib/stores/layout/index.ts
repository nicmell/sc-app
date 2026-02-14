import type {LayoutState} from "@/types/stores";
import type {LayoutItem} from "react-grid-layout";
import {DEFAULT_LAYOUT} from "@/constants/osc";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, LayoutAction} from "@/constants/store";

export type {LayoutState} from "@/types/stores";
export * from "./selectors";

const initialState: LayoutState = {
  layout: DEFAULT_LAYOUT,
};

export const layoutSlice = createSlice({
  name: SliceName.LAYOUT,
  initialState,
  reducers: {
    [LayoutAction.SET_LAYOUT]: (state, action: { payload: LayoutItem[] }) => {
      state.layout = action.payload;
    },
    [LayoutAction.RESET_LAYOUT]: (state) => {
      state.layout = DEFAULT_LAYOUT;
    },
  },
});
