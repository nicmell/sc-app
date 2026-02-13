import type {LayoutState} from "@/types/stores";
import type {LayoutItem} from "react-grid-layout";
import {DEFAULT_LAYOUT} from "@/constants/osc";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, LayoutAction} from "@/constants/store";

const initialState: LayoutState = {
  layout: DEFAULT_LAYOUT,
};

const slice = createSlice({
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

export const layoutInitialState = slice.initialState;
export const layoutReducer = slice.reducer;
export const {setLayout, resetLayout} = slice.actions;
export type LayoutAction = ReturnType<
    | typeof setLayout
    | typeof resetLayout
>;
