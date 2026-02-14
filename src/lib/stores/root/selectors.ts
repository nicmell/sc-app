import type {RootState} from "@/types/stores";

export const scsynth = (s: RootState) => s.scsynth;
export const layout = (s: RootState) => s.layout;
export const theme = (s: RootState) => s.theme;

export default {scsynth, layout, theme};
