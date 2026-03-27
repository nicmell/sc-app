import type {RootState} from "@/types/stores";

export default {
  // state
  isRunning: (s: RootState) => s.isRunning,
  options: (s: RootState) => s.options,
  scsynth: (s: RootState) => s.scsynth,
  layout: (s: RootState) => s.runtime.layout,
  plugins: (s: RootState) => s.plugins,
  runtime: (s: RootState) => s.runtime,
};
