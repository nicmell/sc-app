import type {RootState} from "@/types/stores";

export const selectScsynth = (s: RootState) => s.scsynth;
export const selectLayout = (s: RootState) => s.layout;
export const selectTheme = (s: RootState) => s.theme;
