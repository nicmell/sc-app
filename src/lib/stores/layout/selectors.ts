import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";
const createLayoutSelector: SliceSelector<typeof root.layout> = (fn) =>
  createSelector(root.layout, fn);

export default {
  items: createLayoutSelector(s => s),
  getById: (id: string) => createLayoutSelector(s => s.find(item => item.i === id)),
};
