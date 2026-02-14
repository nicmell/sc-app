import {rootStore} from "@/lib/stores/store";
import {scsynthSlice} from "./scsynth";
import scsynthSelectors from "./scsynth/selectors";
import {layoutSlice} from "./layout";
import layoutSelectors from "./layout/selectors";
import {themeSlice} from "./theme";
import themeSelectors from "./theme/selectors";
import {createApi} from "./utils";

export const scsynthApi = createApi(rootStore, {
  selectors: scsynthSelectors,
  actions: scsynthSlice.actions,
});

export const layoutApi = createApi(rootStore, {
  selectors: layoutSelectors,
  actions: layoutSlice.actions,
});

export const themeApi = createApi(rootStore, {
  selectors: themeSelectors,
  actions: themeSlice.actions,
});
