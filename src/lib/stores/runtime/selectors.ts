import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createRuntimeSelector: SliceSelector<typeof root.runtime> = (fn) =>
  createSelector(root.runtime, fn);

export default {
  layout: createRuntimeSelector(s => s.layout),
  nodes: createRuntimeSelector(s => s.nodes),
  savedTrees: createRuntimeSelector(s => s.savedTrees),
  getById: (id: string) => createRuntimeSelector(s => s.nodes[id]),
};
