import {store} from "@/lib/stores/store";
import root from "./root";
import options from "./options";
import layout from "./layout";
import plugins from "./plugins";
import runtime from "./runtime";
import {createApi} from "./utils";
import {logger} from "@/lib/logger";
import {ScsynthAction} from "@/constants/store";

const wrappedStore = {
  ...store,
  dispatch: (action: any) => {
    if (action.type !== `root/${ScsynthAction.SET_STATUS}`) {
      logger.log(JSON.stringify(action));
    }
    store.getState().dispatch(action);
  },
}

export const rootApi = createApi(wrappedStore, {
  selectors: root.selectors,
  actions: root.actions,
});

export const optionsApi = createApi(wrappedStore, {
  selectors: options.selectors,
  actions: options.actions,
});

export const layoutApi = createApi(wrappedStore, {
  selectors: layout.selectors,
  actions: layout.actions,
});

export const pluginsApi = createApi(wrappedStore, {
  selectors: plugins.selectors,
  actions: plugins.actions,
});

export const runtimeApi = createApi(wrappedStore, {
  selectors: runtime.selectors,
  actions: runtime.actions,
});
