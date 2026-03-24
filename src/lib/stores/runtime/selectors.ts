import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createRuntimeSelector: SliceSelector<typeof root.runtime> = (fn) =>
  createSelector(root.runtime, fn);

export default {
  nodes: createRuntimeSelector(s => s.nodes),
  entries: createRuntimeSelector(s => s.entries),
  getById: (id: string) => createRuntimeSelector(s => s.nodes[id]),
};
