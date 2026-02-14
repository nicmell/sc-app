import {dispatch, rootStore} from "@/lib/stores/rootStore";
import {scsynthSlice} from "./scsynth/scsynthStore";
import scsynthSelectors from "./scsynth/selectors";
import {layoutSlice} from "./layout/layoutStore";
import layoutSelectors from "./layout/selectors";
import {themeSlice} from "./theme/themeStore";
import themeSelectors from "./theme/selectors";
import {createApi, type Store} from "./utils";
import type {RootState} from "@/types/stores";

const store: Store<RootState> = {
  getState: () => rootStore.getState(),
  dispatch,
};

export const scsynthApi = createApi(store, {
  selectors: scsynthSelectors,
  actions: scsynthSlice.actions,
});

export const layoutApi = createApi(store, {
  selectors: layoutSelectors,
  actions: layoutSlice.actions,
});

export const themeApi = createApi(store, {
  selectors: themeSelectors,
  actions: themeSlice.actions,
});
