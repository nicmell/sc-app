import type {RootState} from "@/types/stores";

export const selectLayout = (s: RootState) => s.layout.layout;
