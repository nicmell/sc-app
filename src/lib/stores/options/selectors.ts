import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createOptionsSelector: SliceSelector<typeof root.options> = (fn) =>
    createSelector(root.options, fn);

export default {
    // state
    theme: createOptionsSelector(s => s.theme),
    layout: createOptionsSelector(s => s.layout),
    scsynth: createOptionsSelector(s => s.scsynth),

    // convenience
    mode: createOptionsSelector(s => s.theme.mode),
    primaryColor: createOptionsSelector(s => s.theme.primaryColor),

    // derived (migrated from scsynth selectors)
    address: createOptionsSelector(s => `${s.scsynth.host}:${s.scsynth.port}`),
};
