import type {StateCreator} from "zustand";
import type {LayoutState} from "@/types/stores";
import {DEFAULT_LAYOUT} from "@/constants/store";

export const layoutSlice: StateCreator<LayoutState> = (set) => ({
  layout: DEFAULT_LAYOUT,
  setLayout: (layout) => set({layout}),
  resetLayout: () => set({layout: DEFAULT_LAYOUT}),
});
