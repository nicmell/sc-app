import type {LayoutState} from "@/types/stores";
import type {LayoutItem} from "react-grid-layout";
import {DEFAULT_LAYOUT} from "@/constants/store";
import {createSlice, type InferAction} from "@/lib/stores/utils";

const initialState: LayoutState = {
  layout: DEFAULT_LAYOUT,
};

const slice = createSlice({
  name: "layout",
  initialState,
  reducers: {
    setLayout: (state, action: { payload: LayoutItem[] }) => {
      state.layout = action.payload;
    },
    resetLayout: (state) => {
      state.layout = DEFAULT_LAYOUT;
    },
  },
});

export const layoutInitialState = slice.initialState;
export const layoutReducer = slice.reducer;
export const {setLayout, resetLayout} = slice.actions;
export type LayoutAction = InferAction<typeof slice>;
