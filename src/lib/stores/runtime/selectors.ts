import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";
const createRuntimeSelector: SliceSelector<typeof root.runtime> = (fn) =>
  createSelector(root.runtime, fn);

export default {
  entries: createRuntimeSelector(s => s.entries),
  layout: createRuntimeSelector(s => s.layout),
  getBox: (id: string) => createRuntimeSelector(s => s.layout[id]),
};
