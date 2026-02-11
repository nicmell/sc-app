import {create} from "zustand";
import {persist, createJSONStorage} from "zustand/middleware";
import {tauriStorage} from "@/lib/storage/tauriStorage";

type Mode = "dark" | "light";

interface ThemeState {
  mode: Mode;
  primaryColor: string;
  setMode: (mode: Mode) => void;
  setPrimaryColor: (color: string) => void;
}

const getSystemMode = (): Mode =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: getSystemMode(),
      primaryColor: "#396cd8",
      setMode: (mode) => set({mode}),
      setPrimaryColor: (primaryColor) => set({primaryColor}),
    }),
    {
      name: "theme",
      storage: createJSONStorage(() => tauriStorage),
      partialize: ({mode, primaryColor}) => ({mode, primaryColor}),
    },
  ),
);
