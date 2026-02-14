import {store} from "@/lib/stores/store";
import root from "./root";
import scsynth from "./scsynth";
import layout from "./layout";
import theme from "./theme";
import {createApi} from "./utils";

export const rootApi = createApi(store, {
  selectors: root.selectors,
  actions: root.actions,
});

export const scsynthApi = createApi(store, {
  selectors: scsynth.selectors,
  actions: scsynth.actions,
});

export const layoutApi = createApi(store, {
  selectors: layout.selectors,
  actions: layout.actions,
});

export const themeApi = createApi(store, {
  selectors: theme.selectors,
  actions: theme.actions,
});
