import {createStore} from "zustand/vanilla";
import {useStore} from "zustand";
import {persist} from "zustand/middleware";
import {tauriStorage} from "@/lib/storage/tauriStorage";
import {createSlice} from "./utils";
import {themeSlice, type ThemeState} from "./themeStore";
import {layoutSlice, type LayoutState} from "./layoutStore";
import {scsynthSlice, type ScsynthState} from "./scsynthStore";

export type {ScsynthOptions, ScsynthStatus} from "./scsynthStore";

export interface AppState {
  theme: ThemeState;
  layout: LayoutState;
  scsynth: ScsynthState;
}

export const appStore = createStore<AppState>()(
  persist(
    (_set, _get, api) => ({
      ...createSlice(api, "theme")(themeSlice),
      ...createSlice(api, "layout")(layoutSlice),
      ...createSlice(api, "scsynth")(scsynthSlice),
    }),
    {
      name: "settings",
      storage: tauriStorage,
      partialize: ({theme, layout, scsynth}) => ({
        theme: {mode: theme.mode, primaryColor: theme.primaryColor},
        layout: {layout: layout.layout},
        scsynth: {options: scsynth.options},
      }),
      merge: (persisted, current) => {
        const p = persisted as Record<string, Record<string, unknown>> | undefined;
        return {
          ...current,
          theme: {...current.theme, ...p?.theme},
          layout: {...current.layout, ...p?.layout},
          scsynth: {...current.scsynth, ...p?.scsynth},
        };
      },
    },
  ),
);

export const useAppStore = <T>(selector: (state: AppState) => T) =>
  useStore(appStore, selector);
