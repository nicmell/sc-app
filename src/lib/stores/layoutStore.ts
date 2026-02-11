import {create} from "zustand";
import type {LayoutItem} from "react-grid-layout";

const DEFAULT_LAYOUT: LayoutItem[] = [
  {i: "server", x: 0, y: 0, w: 6, h: 3},
  {i: "synth", x: 6, y: 0, w: 6, h: 3},
  {i: "log", x: 0, y: 3, w: 12, h: 4},
];

interface LayoutState {
  layout: LayoutItem[];
  setLayout: (layout: LayoutItem[]) => void;
  resetLayout: () => void;
}

export const useLayoutStore = create<LayoutState>((set) => ({
  layout: DEFAULT_LAYOUT,
  setLayout: (layout) => set({layout}),
  resetLayout: () => set({layout: DEFAULT_LAYOUT}),
}));
