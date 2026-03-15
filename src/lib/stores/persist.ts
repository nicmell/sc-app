import type {PersistOptions} from "zustand/middleware";
import {tauriStorage} from "@/lib/storage/tauriStorage";
import {stripRuntime} from "@/lib/parsers";
import type {RootState, ConfigFile} from "@/types/stores";

// State generic uses `any` because the redux middleware adds `dispatch` to the
// actual store state, which isn't part of RootState.  The partialize/merge
// functions are fully typed via ConfigFile and RootState.
export const persistConfig: PersistOptions<any, ConfigFile> = {
  name: "config",
  storage: tauriStorage,
  partialize: ({theme, layout, scsynth, plugins, runtime}: RootState): ConfigFile => ({ // isRunning excluded
    theme: {mode: theme.mode, primaryColor: theme.primaryColor},
    layout: {
      items: layout.items,
      options: layout.options,
    },
    scsynth: {options: scsynth.options},
    plugins: plugins.items
        .map(({loaded: _loaded, error: _error, ...plugin}) => ({...plugin})),
    runtime: {
      entries: runtime.entries,
      elements: runtime.elements.map(plugin => ({
        ...plugin,
        children: stripRuntime(plugin.children),
      })),
    },
  }),
  merge: (persisted, current: RootState): RootState => {
    const p = persisted as ConfigFile | undefined;
    return {
      ...current,
      theme: {...current.theme, ...p?.theme},
      layout: {...current.layout, ...p?.layout},
      scsynth: {...current.scsynth, ...p?.scsynth},
      plugins: {
        items: Array.isArray(p?.plugins)
          ? p.plugins.map(pp => {
              const cur = current.plugins.items.find(c => c.id === pp.id);
              return cur ? {...cur, ...pp} : pp;
            })
          : current.plugins.items,
      },
      runtime: p?.runtime ?? current.runtime,
    };
  },
};
