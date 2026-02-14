import type {RootState} from "@/types/stores";

export const mode = (s: RootState) => s.theme.mode;

export const primaryColor = (s: RootState) => s.theme.primaryColor;

export default {mode, primaryColor};
