import {createStore} from "zustand/vanilla";
import {useStore} from "zustand";
import {persist} from "zustand/middleware";
import {tauriStorage} from "@/lib/storage/tauriStorage";
import {combineSlices} from "./utils";
import {themeSlice} from "./theme";
import {layoutSlice} from "./layout";
import {scsynthSlice} from "./scsynth";
import type {RootState} from "@/types/stores";

export type {RootState, ScsynthOptions, ScsynthStatus} from "@/types/stores";

export const rootStore = createStore<RootState>()(
  persist(
    (_set, _get, api) => combineSlices(api, {
      theme: themeSlice,
      layout: layoutSlice,
      scsynth: scsynthSlice
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

export const useRootStore = <T>(selector: (state: RootState) => T) =>
  useStore(rootStore, selector);
