import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createPluginsSelector: SliceSelector<typeof root.plugins> = (fn) =>
  createSelector(root.plugins, fn);

const getById = (id: string) =>
  createPluginsSelector(s => s.items.find(p => p.id === id));

export default {
  items: createPluginsSelector(s => s.items),
  getById,
};
