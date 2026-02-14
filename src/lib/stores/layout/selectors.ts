import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createLayoutSelector: SliceSelector<typeof root.layout> = (fn) =>
  createSelector(root.layout, fn);

export default {
  // state
  items: createLayoutSelector(s => s.items),
  options: createLayoutSelector(s => s.options),
};
