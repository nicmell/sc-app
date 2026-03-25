import type {PersistOptions} from "zustand/middleware";
import {tauriStorage} from "@/lib/storage/tauriStorage";
import type {RootState, ConfigFile} from "@/types/stores";
import {marshalTree, unmarshalTree} from "@/lib/runtime";

// State generic uses `any` because the redux middleware adds `dispatch` to the
// actual store state, which isn't part of RootState.  The partialize/merge
// functions are fully typed via ConfigFile and RootState.
export const persistConfig: PersistOptions<any, ConfigFile> = {
  name: "config",
  storage: tauriStorage,
  partialize: ({theme, scsynth, plugins, runtime}: RootState): ConfigFile => ({ // isRunning excluded
    theme: {mode: theme.mode, primaryColor: theme.primaryColor},
    scsynth: {options: scsynth.options},
    plugins: plugins.items
        .map(({loaded: _loaded, error: _error, ...plugin}) => ({...plugin})),
    runtime: {
      layout: {items: runtime.layout.items, options: runtime.layout.options},
      tree: marshalTree(runtime.nodes).map(item => ({...item, runtime: {...item.runtime, loaded: false, error: undefined}})),
      entries: runtime.entries,
    },
  }),
  merge: (persisted, current: RootState): RootState => {
    const p = persisted as ConfigFile | undefined;
    return {
      ...current,
      theme: {...current.theme, ...p?.theme},
      scsynth: {...current.scsynth, ...p?.scsynth},
      plugins: {
        items: Array.isArray(p?.plugins)
          ? p.plugins.map(pp => {
              const cur = current.plugins.items.find(c => c.id === pp.id);
              return cur ? {...cur, ...pp} : pp;
            })
          : current.plugins.items,
      },
      runtime: {
        ...current.runtime,
        layout: p?.runtime?.layout ? {...current.runtime.layout, ...p.runtime.layout} : current.runtime.layout,
        nodes: p?.runtime?.tree ? unmarshalTree(p.runtime.tree) : current.runtime.nodes,
        entries: p?.runtime?.entries ?? current.runtime.entries,
      },
    };
  },
};
