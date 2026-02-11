import {create} from "zustand";

type Mode = "dark" | "light";

interface ThemeState {
  mode: Mode;
  primaryColor: string;
  setMode: (mode: Mode) => void;
  setPrimaryColor: (color: string) => void;
}

const getSystemMode = (): Mode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const useThemeStore = create<ThemeState>((set) => ({
  mode: getSystemMode(),
  primaryColor: "#396cd8",
  setMode: (mode) => set({mode}),
  setPrimaryColor: (primaryColor) => set({primaryColor}),
}));
