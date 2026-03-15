import type {PersistOptions} from "zustand/middleware";
import {tauriStorage} from "@/lib/storage/tauriStorage";
import {stripRuntime} from "@/lib/parsers";
import type {ScPluginNode} from "@/lib/parsers";
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
      items: layout.items.map(box => {
        const plugin = runtime.elements.find(p => p.id === box.i);
        return {
          ...box,
          elements: plugin?.children ? stripRuntime(plugin.children) : undefined,
        };
      }),
      options: layout.options,
    },
    scsynth: {options: scsynth.options},
    plugins: plugins.items
        .map(({loaded: _loaded, error: _error, ...plugin}) => ({...plugin})),
  }),
  merge: (persisted, current: RootState): RootState => {
    const p = persisted as ConfigFile | undefined;
    const runtimeElements: ScPluginNode[] = [];
    const items = p?.layout?.items?.map(({elements, ...box}) => {
      if (elements) {
        runtimeElements.push({type: 'sc-plugin', id: box.i, boxId: box.i, children: elements, runtime: {loaded: false}});
      }
      return box;
    });
    return {
      ...current,
      theme: {...current.theme, ...p?.theme},
      layout: {
        items: items ?? current.layout.items,
        options: p?.layout?.options ?? current.layout.options,
      },
      scsynth: {...current.scsynth, ...p?.scsynth},
      plugins: {
        items: Array.isArray(p?.plugins)
          ? p.plugins.map(pp => {
              const cur = current.plugins.items.find(c => c.id === pp.id);
              return cur ? {...cur, ...pp} : pp;
            })
          : current.plugins.items,
      },
      runtime: {...current.runtime, elements: runtimeElements},
    };
  },
};
