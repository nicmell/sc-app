import type {SliceActions} from "@/lib/stores/utils";
import type {scsynthSlice} from "@/lib/stores/scsynth/slice";
import type {layoutSlice} from "@/lib/stores/layout/slice";
import type {themeSlice} from "@/lib/stores/theme/slice";
import type {pluginsSlice} from "@/lib/stores/plugins/slice";

export interface BoxItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  plugin?: string;
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

export interface LayoutOptions {
  numRows: number;
  numColumns: number;
}

export interface LayoutState {
  items: BoxItem[];
  options: LayoutOptions;
}

export interface ThemeState {
  mode: Mode;
  primaryColor: string;
}

export interface AssetInfo {
  path: string;
  type: string;
}

export interface PluginError {
  code: number;
  message: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  author: string;
  version: string;
  entry: string;
  assets: AssetInfo[];
  // Runtime-only (not persisted)
  loaded?: boolean;
  error?: PluginError;
  violations?: string[];
}

export type PersistedPlugin = Omit<PluginInfo, 'loaded' | 'error' | 'violations'>;

export interface ConfigFile {
  theme: Pick<ThemeState, 'mode' | 'primaryColor'>;
  layout: Pick<LayoutState, 'items' | 'options'>;
  scsynth: Pick<ScsynthState, 'options'>;
  plugins: Omit<PluginInfo, 'loaded' | 'error' | 'violations'>[];
}

export interface PluginsState {
  items: PluginInfo[];
}

export interface RootState {
  theme: ThemeState;
  layout: LayoutState;
  scsynth: ScsynthState;
  plugins: PluginsState;
}

export type ScsynthAction = SliceActions<typeof scsynthSlice.actions>;
export type LayoutAction = SliceActions<typeof layoutSlice.actions>;
export type ThemeAction = SliceActions<typeof themeSlice.actions>;
export type PluginsAction = SliceActions<typeof pluginsSlice.actions>;
export type RootAction = ScsynthAction | LayoutAction | ThemeAction | PluginsAction;
