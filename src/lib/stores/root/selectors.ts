import type {RootState} from "@/types/stores";

export default {
  // state
  scsynth: (s: RootState) => s.scsynth,
  layout: (s: RootState) => s.layout,
  theme: (s: RootState) => s.theme,
  nodes: (s: RootState) => s.nodes,
  plugins: (s: RootState) => s.plugins,
};
