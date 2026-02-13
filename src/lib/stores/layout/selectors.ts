import type {RootState} from "@/types/stores";

export const selectLayout = (s: RootState) => s.layout.layout;

export const selectSetLayout = (s: RootState) => s.layout.setLayout;

export const selectResetLayout = (s: RootState) => s.layout.resetLayout;
