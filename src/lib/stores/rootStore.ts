import {createStore} from "zustand/vanilla";
import {useStore} from "zustand";
import {persist} from "zustand/middleware";
import {immer} from "zustand/middleware/immer";
import {redux} from "zustand/middleware";
import {tauriStorage} from "@/lib/storage/tauriStorage";
import {scsynthInitialState, scsynthReducer} from "./scsynth/scsynthStore";
import {layoutInitialState, layoutReducer} from "./layout/layoutStore";
import {themeInitialState, themeReducer} from "./theme/themeStore";
import {combineReducers} from "./utils";
import type {RootState} from "@/types/stores";
import type {RootAction} from "./actions";

export type {RootAction} from "./actions";
export type {RootState, ScsynthOptions, ScsynthStatus} from "@/types/stores";

const rootInitialState: RootState = {
  scsynth: scsynthInitialState,
  layout: layoutInitialState,
  theme: themeInitialState,
};

const rootReducerImpl = combineReducers<RootState>({
  scsynth: scsynthReducer,
  layout: layoutReducer,
  theme: themeReducer,
});

function rootReducer(state: RootState, action: RootAction): RootState {
  rootReducerImpl(state, action);
  return state;
}

export const rootStore = createStore(
  persist(
    immer(redux(rootReducer, rootInitialState)),
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

export const dispatch = (action: RootAction) =>
  rootStore.getState().dispatch(action);

export const useDispatch = () =>
  useStore(rootStore, (s) => s.dispatch);

export const useRootStore = <T>(selector: (state: RootState) => T): T =>
  useStore(rootStore, (state) => selector(state));
