import root from "@/lib/stores/root/selectors";
import {createSelector} from "@/lib/stores/utils";

const selectors = {
  mode: createSelector(root.theme, s => s.mode),
  primaryColor: createSelector(root.theme, s => s.primaryColor),
} as const;

export const {mode, primaryColor} = selectors;
export default selectors;
