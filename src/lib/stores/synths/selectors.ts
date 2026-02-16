import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createSynthsSelector: SliceSelector<typeof root.synths> = (fn) =>
  createSelector(root.synths, fn);

export default {
  items: createSynthsSelector(s => s.items),
};
