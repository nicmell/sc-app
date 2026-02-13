import type {StateCreator} from "zustand";
import type {Mode, ThemeState} from "@/types/stores";

const getSystemMode = (): Mode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const themeSlice: StateCreator<ThemeState> = (set) => ({
  mode: getSystemMode(),
  primaryColor: "#396cd8",
  setMode: (mode) => set({mode}),
  setPrimaryColor: (primaryColor) => set({primaryColor}),
});
