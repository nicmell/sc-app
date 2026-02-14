import {createStore} from "zustand/vanilla";
import {useStore} from "zustand";
import {persist} from "zustand/middleware";
import {immer} from "zustand/middleware/immer";
import {redux} from "zustand/middleware";
import {rootReducer, rootInitialState} from "./root";
import {persistConfig} from "./persist";
import type {RootAction, RootState} from "@/types/stores";

export type {RootAction, RootState, ScsynthOptions, ScsynthStatus} from "@/types/stores";

export const rootStore = createStore(
  persist(
    immer(redux(rootReducer, rootInitialState)),
    persistConfig,
  ),
);

export const dispatch = (action: RootAction) =>
  rootStore.getState().dispatch(action);

export const useDispatch = () =>
  useStore(rootStore, (s) => s.dispatch);

export const useRootStore = <T>(selector: (state: RootState) => T): T =>
  useStore(rootStore, (state) => selector(state));
