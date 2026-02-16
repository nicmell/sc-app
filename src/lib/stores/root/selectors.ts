import type {RootState} from "@/types/stores";

export default {
  // state
  scsynth: (s: RootState) => s.scsynth,
  layout: (s: RootState) => s.layout,
  theme: (s: RootState) => s.theme,
  synths: (s: RootState) => s.synths,
  plugins: (s: RootState) => s.plugins,
};
