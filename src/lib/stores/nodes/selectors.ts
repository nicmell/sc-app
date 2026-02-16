import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createNodesSelector: SliceSelector<typeof root.nodes> = (fn) =>
  createSelector(root.nodes, fn);

export default {
  items: createNodesSelector(s => s.items),
};
