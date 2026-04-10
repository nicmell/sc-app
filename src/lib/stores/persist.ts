import type {PersistOptions} from "zustand/middleware";
import {IS_TAURI} from "@/lib/env";
import {tauriStorage} from "@/lib/storage/tauriStorage";
import {browserStorage} from "@/lib/storage/browserStorage";
import type {RootState, ConfigFile} from "@/types/stores";
import {marshalPreset, unmarshalPreset} from "@/lib/runtime";

// State generic uses `any` because the redux middleware adds `dispatch` to the
// actual store state, which isn't part of RootState.  The partialize/merge
// functions are fully typed via ConfigFile and RootState.
export const persistConfig: PersistOptions<any, ConfigFile> = {
  name: "config",
  storage: IS_TAURI ? tauriStorage : browserStorage,
  partialize: ({options, plugins, runtime}: RootState): ConfigFile => ({
    options,
    plugins: plugins.items
        .map(({loaded: _loaded, error: _error, ...plugin}) => ({...plugin})),
    activePreset: marshalPreset(runtime),
  }),
  merge: (persisted, current: RootState): RootState => {
    const p = persisted as ConfigFile | undefined;
    return {
      ...current,
      options: p?.options ?? current.options,
      plugins: {items: p?.plugins ?? current.plugins.items},
      runtime: p?.activePreset ? unmarshalPreset(p.activePreset) : current.runtime,
    };
  },
};
