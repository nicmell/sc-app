import type {Mode, ThemeState} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, ThemeAction} from "@/constants/store";

export type {ThemeState, Mode} from "@/types/stores";
export * from "./selectors";

const getSystemMode = (): Mode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const initialState: ThemeState = {
  mode: getSystemMode(),
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
