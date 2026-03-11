import {store} from "@/lib/stores/store";
import root from "./root";
import scsynth from "./scsynth";
import layout from "./layout";
import theme from "./theme";
import plugins from "./plugins";
import {createApi} from "./utils";
import {logger} from "@/lib/logger";

const wrappedStore = {
  ...store,
  dispatch: (action: any) => {
    if (!scsynth.actions.setStatus.match(action))
    logger.log(JSON.stringify(action));
    store.getState().dispatch(action);
  },
}

export const rootApi = createApi(wrappedStore, {
  selectors: root.selectors,
  actions: root.actions,
});

export const scsynthApi = createApi(wrappedStore, {
  selectors: scsynth.selectors,
  actions: scsynth.actions,
});

export const layoutApi = createApi(wrappedStore, {
  selectors: layout.selectors,
  actions: layout.actions,
});

export const themeApi = createApi(wrappedStore, {
  selectors: theme.selectors,
  actions: theme.actions,
});

export const pluginsApi = createApi(wrappedStore, {
  selectors: plugins.selectors,
  actions: plugins.actions,
});
