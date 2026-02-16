import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createGroupsSelector: SliceSelector<typeof root.groups> = (fn) =>
  createSelector(root.groups, fn);

export default {
  items: createGroupsSelector(s => s.items),
};
