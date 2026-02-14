import type {SliceActions} from "@/lib/stores/utils";
import type {scsynthSlice} from "@/lib/stores/scsynth/slice";
import type {layoutSlice} from "@/lib/stores/layout/slice";
import type {themeSlice} from "@/lib/stores/theme/slice";

export interface BoxItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type Mode = "dark" | "light";

export interface ScsynthOptions {
  host: string;
  port: number;
  initialNodeId: number;
  pollStatusMs: number;
}

export interface ScsynthStatus {
  ugens: number;
  synths: number;
  groups: number;
  defs: number;
  avgCpu: number;
  peakCpu: number;
  sampleRate: number;
}

export interface ScsynthState {
  clientId: number;
  options: ScsynthOptions;
  connectionStatus: ConnectionStatus;
  status: ScsynthStatus;
  version: string;
}

export interface LayoutState {
  layout: BoxItem[];
}

export interface ThemeState {
  mode: Mode;
  primaryColor: string;
}

export interface RootState {
  theme: ThemeState;
  layout: LayoutState;
  scsynth: ScsynthState;
}

export type ScsynthAction = SliceActions<typeof scsynthSlice.actions>;
export type LayoutAction = SliceActions<typeof layoutSlice.actions>;
export type ThemeAction = SliceActions<typeof themeSlice.actions>;
export type RootAction = ScsynthAction | LayoutAction | ThemeAction;
