import type {StateCreator} from "zustand";

type Mode = "dark" | "light";

const getSystemMode = (): Mode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export interface ThemeState {
  mode: Mode;
  primaryColor: string;
  setMode: (mode: Mode) => void;
  setPrimaryColor: (color: string) => void;
}

export const createThemeSlice: StateCreator<ThemeState> = (set) => ({
  mode: getSystemMode(),
  primaryColor: "#396cd8",
  setMode: (mode) => set({mode}),
  setPrimaryColor: (primaryColor) => set({primaryColor}),
});
