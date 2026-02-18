import scsynth from "@/lib/stores/scsynth/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createNodesSelector: SliceSelector<typeof scsynth.nodes> = (fn) =>
  createSelector(scsynth.nodes, fn);

export default {
  items: createNodesSelector(s => s.items),
};
