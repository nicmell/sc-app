import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createRuntimeSelector: SliceSelector<typeof root.runtime> = (fn) =>
  createSelector(root.runtime, fn);

export default {
  items: createRuntimeSelector(s => s.items),
  getById: (id: string) => createRuntimeSelector(s => s.items.find(item => item.id === id)),
};
