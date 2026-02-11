import {create} from "zustand";

type Mode = "dark" | "light";

interface ThemeState {
  mode: Mode;
  primaryColor: string;
  setMode: (mode: Mode) => void;
  setPrimaryColor: (color: string) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "dark",
  primaryColor: "#396cd8",
  setMode: (mode) => set({mode}),
  setPrimaryColor: (primaryColor) => set({primaryColor}),
}));
