import type {PersistOptions} from "zustand/middleware";
import {tauriStorage} from "@/lib/storage/tauriStorage";
import type {RootState} from "@/types/stores";

export const persistConfig: PersistOptions<any> = {
  name: "settings",
  storage: tauriStorage,
  partialize: ({theme, layout, scsynth}: RootState) => ({
    theme: {mode: theme.mode, primaryColor: theme.primaryColor},
    layout: {items: layout.items, options: layout.options},
    scsynth: {options: scsynth.options},
  }),
  merge: (persisted, current: RootState) => {
    const p = persisted as Record<string, Record<string, unknown>> | undefined;
    return {
      ...current,
      theme: {...current.theme, ...p?.theme},
      layout: {...current.layout, ...p?.layout},
      scsynth: {...current.scsynth, ...p?.scsynth},
    };
  },
};
