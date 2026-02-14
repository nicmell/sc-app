import root from "@/lib/stores/root/selectors";
import {createSelector} from "@/lib/stores/utils";

export const mode = createSelector(root.theme, s => s.mode);

export const primaryColor = createSelector(root.theme, s => s.primaryColor);

export default {mode, primaryColor};
