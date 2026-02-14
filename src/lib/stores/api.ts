import {dispatch, rootStore} from "@/lib/stores/rootStore";
import {scsynthSlice} from "./scsynth/scsynthStore";
import scsynthSelectors from "./scsynth/selectors";
import {layoutSlice} from "./layout/layoutStore";
import layoutSelectors from "./layout/selectors";
import {themeSlice} from "./theme/themeStore";
import themeSelectors from "./theme/selectors";
import {createApi} from "./utils";

const getState = () => rootStore.getState();

export const scsynthApi = createApi({
  selectors: scsynthSelectors,
  actions: scsynthSlice.actions,
  getState,
  dispatch,
});

export const layoutApi = createApi({
  selectors: layoutSelectors,
  actions: layoutSlice.actions,
  getState,
  dispatch,
});

export const themeApi = createApi({
  selectors: themeSelectors,
  actions: themeSlice.actions,
  getState,
  dispatch,
});
