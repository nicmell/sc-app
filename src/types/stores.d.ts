import type {SliceActions} from "@/lib/stores/utils";
import type {rootSlice} from "@/lib/stores/root/slice";
import type {scsynthSlice} from "@/lib/stores/scsynth/slice";
import type {layoutSlice} from "@/lib/stores/layout/slice";
import type {themeSlice} from "@/lib/stores/theme/slice";
import type {pluginsSlice} from "@/lib/stores/plugins/slice";
import type {runtimeSlice} from "@/lib/stores/runtime/slice";
import type {ScElementNode, ScPluginNode} from "@/lib/parsers";
import type {RuntimeEntry} from "@/lib/runtime/types";

export interface BoxItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  plugin?: string;
}

export interface PersistedBoxItem extends BoxItem {
  elements?: ScElementNode[];
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type Mode = "dark" | "light" | "adaptive";

export interface ScsynthOptions {
  host: string;
  port: number;
  clientId: number;
  pollStatusMs: number;
  replyTimeoutMs: number;
  msgLatencyMs: number;
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

export interface PluginInfo {
  id: string;
  name: string;
  author: string;
  version: string;
  entry: string;
  assets: AssetInfo[];
  // Runtime-only (not persisted)
  loaded?: boolean;
  error?: string;
}

export type PersistedPlugin = Omit<PluginInfo, 'loaded' | 'error'>;

export interface ConfigFile {
  theme: Pick<ThemeState, 'mode' | 'primaryColor'>;
  layout: { items: PersistedBoxItem[]; options: LayoutOptions };
  scsynth: Pick<ScsynthState, 'options'>;
  plugins: PersistedPlugin[];
}

export interface PluginsState {
  items: PluginInfo[];
}

export interface RuntimeState {
  entries: RuntimeEntry[];
  elements: ScPluginNode[];
}

export interface RootState {
  isRunning: boolean;
  theme: ThemeState;
  layout: LayoutState;
  scsynth: ScsynthState;
  plugins: PluginsState;
  runtime: RuntimeState;
}

export type RootOwnAction = SliceActions<typeof rootSlice.actions>;
export type ScsynthAction = SliceActions<typeof scsynthSlice.actions>;
export type LayoutAction = SliceActions<typeof layoutSlice.actions>;
export type ThemeAction = SliceActions<typeof themeSlice.actions>;
export type PluginsAction = SliceActions<typeof pluginsSlice.actions>;
export type RuntimeAction = SliceActions<typeof runtimeSlice.actions>;
export type RootAction = RootOwnAction | ScsynthAction | LayoutAction | ThemeAction | PluginsAction | RuntimeAction;
