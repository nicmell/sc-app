import root from "@/lib/stores/root/selectors";
import {createSelector} from "@/lib/stores/utils";

const selectors = {
  layout: createSelector(root.layout, s => s.layout),
} as const;

export const {layout} = selectors;
export default selectors;
