import type {RootState} from "@/types/stores";

export default {
  // state
  isRunning: (s: RootState) => s.isRunning,
  scsynth: (s: RootState) => s.scsynth,
  layout: (s: RootState) => s.layout,
  theme: (s: RootState) => s.theme,
  plugins: (s: RootState) => s.plugins,
};
