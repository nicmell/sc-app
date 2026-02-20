import type {Mode, ThemeState} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, ThemeAction} from "@/constants/store";

const initialState: ThemeState = {
  mode: "adaptive",
  primaryColor: "#396cd8",
};

export const themeSlice = createSlice({
  name: SliceName.THEME,
  initialState,
  reducers: {
    [ThemeAction.SET_MODE]: (state, action: { payload: Mode }) => {
      state.mode = action.payload;
    },
    [ThemeAction.SET_PRIMARY_COLOR]: (state, action: { payload: string }) => {
      state.primaryColor = action.payload;
    },
  },
});
