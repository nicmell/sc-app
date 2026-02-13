import type {Mode, ThemeState} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, ThemeAction} from "@/constants/store";

const getSystemMode = (): Mode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const initialState: ThemeState = {
  mode: getSystemMode(),
  primaryColor: "#396cd8",
};

const slice = createSlice({
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

export const themeInitialState = slice.initialState;
export const themeReducer = slice.reducer;
export const {setMode, setPrimaryColor} = slice.actions;
export type ThemeAction = ReturnType<
    | typeof setMode
    | typeof setPrimaryColor
>;
