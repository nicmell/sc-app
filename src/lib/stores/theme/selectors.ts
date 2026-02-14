import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createThemeSelector: SliceSelector<typeof root.theme> = (fn) =>
  createSelector(root.theme, fn);

export default {
  // state
  mode: createThemeSelector(s => s.mode),
  primaryColor: createThemeSelector(s => s.primaryColor),
};
