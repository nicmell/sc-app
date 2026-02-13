import type {RootState} from "@/types/stores";

export const selectThemeMode = (s: RootState) => s.theme.mode;

export const selectPrimaryColor = (s: RootState) => s.theme.primaryColor;
