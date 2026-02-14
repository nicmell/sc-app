import {createStore} from "zustand/vanilla";
import {useStore} from "zustand";
import {persist} from "zustand/middleware";
import {immer} from "zustand/middleware/immer";
import {redux} from "zustand/middleware";
import root from "./root";
import {persistConfig} from "./persist";
import type {RootAction, RootState} from "@/types/stores";

export type {RootAction, RootState, ScsynthOptions, ScsynthStatus} from "@/types/stores";

const ENABLE_PERSISTENCE = true;

const coreStore = immer(redux(root.reducer, root.getInitialState()));

export const store = ENABLE_PERSISTENCE
  ? createStore(persist(coreStore, persistConfig))
  : createStore(coreStore);

export const dispatch = (action: RootAction) =>
  store.getState().dispatch(action);

export const useDispatch = () =>
  useStore(store, (s) => s.dispatch);

export const useSelector = <T>(selector: (state: RootState) => T): T =>
  useStore(store, (state) => selector(state));
