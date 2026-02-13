import type {Mode, ThemeState} from "@/types/stores";
import {createSlice, type InferAction} from "@/lib/stores/utils";

const getSystemMode = (): Mode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const initialState: ThemeState = {
  mode: getSystemMode(),
  primaryColor: "#396cd8",
};

const slice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setMode: (state, action: { payload: Mode }) => {
      state.mode = action.payload;
    },
    setPrimaryColor: (state, action: { payload: string }) => {
      state.primaryColor = action.payload;
    },
  },
});

export const themeInitialState = slice.initialState;
export const themeReducer = slice.reducer;
export const {setMode, setPrimaryColor} = slice.actions;
export type ThemeAction = InferAction<typeof slice>;
