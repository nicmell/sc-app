import type {PersistOptions} from "zustand/middleware";
import {tauriStorage} from "@/lib/storage/tauriStorage";
import type {RootState, ConfigFile, OptionsState, ThemeOptions, ScsynthOptions} from "@/types/stores";
import {marshalTree, unmarshalTree} from "@/lib/runtime";

// State generic uses `any` because the redux middleware adds `dispatch` to the
// actual store state, which isn't part of RootState.  The partialize/merge
// functions are fully typed via ConfigFile and RootState.
export const persistConfig: PersistOptions<any, ConfigFile> = {
  name: "config",
  storage: tauriStorage,
  partialize: ({options, plugins, runtime}: RootState): ConfigFile => ({
    options,
    plugins: plugins.items
        .map(({loaded: _loaded, error: _error, ...plugin}) => ({...plugin})),
    runtime: marshalTree(runtime),
  }),
  merge: (persisted, current: RootState): RootState => {
    const p = persisted as (ConfigFile & {
      // backward compat: old config shape
      theme?: ThemeOptions;
      scsynth?: { options?: ScsynthOptions };
    }) | undefined;

    // Migration: build options from old shape if new shape not present
    const persistedOptions: OptionsState | undefined = p?.options ?? (p?.theme || p?.scsynth?.options ? {
      theme: p?.theme ?? current.options.theme,
      layout: current.options.layout,
      scsynth: p?.scsynth?.options ?? current.options.scsynth,
    } : undefined);

    return {
      ...current,
      options: persistedOptions
        ? {
            theme: {...current.options.theme, ...persistedOptions.theme},
            layout: {...current.options.layout, ...persistedOptions.layout},
            scsynth: {...current.options.scsynth, ...persistedOptions.scsynth},
          }
        : current.options,
      plugins: {
        items: Array.isArray(p?.plugins)
          ? p.plugins.map(pp => {
              const cur = current.plugins.items.find(c => c.id === pp.id);
              return cur ? {...cur, ...pp} : pp;
            })
          : current.plugins.items,
      },
      runtime: p?.runtime ? unmarshalTree(p.runtime) : current.runtime,
    };
  },
};
