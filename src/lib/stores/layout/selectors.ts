import root from "@/lib/stores/root/selectors";
import {createSelector} from "@/lib/stores/utils";

export const layout = createSelector(root.layout, s => s.layout);

export default {layout};
