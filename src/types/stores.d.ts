import type {SliceActions} from "@/lib/stores/utils";
import type {rootSlice} from "@/lib/stores/root/slice";
import type {scsynthSlice} from "@/lib/stores/scsynth/slice";
import type {layoutSlice} from "@/lib/stores/layout/slice";
import type {optionsSlice} from "@/lib/stores/options/slice";
import type {pluginsSlice} from "@/lib/stores/plugins/slice";
import type {runtimeSlice} from "@/lib/stores/runtime/slice";
import type {ScPluginNode, ScElementNode, ScElementNodeBase, StripRuntime} from "@/types/parsers";

export interface BoxItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  plugin?: string;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type Mode = "dark" | "light" | "adaptive";

export interface ThemeOptions {
  mode: Mode;
  primaryColor: string;
}

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
  connectionStatus: ConnectionStatus;
  status: ScsynthStatus;
  version: string;
}

export interface LayoutOptions {
  numRows: number;
  numColumns: number;
}

export type LayoutState = BoxItem[];

export interface OptionsState {
  theme: ThemeOptions;
  layout: LayoutOptions;
  scsynth: ScsynthOptions;
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

export interface PresetItem extends BoxItem {
  tree?: StripRuntime<ScPluginNode>;
}

export interface Preset {
  layout: PresetItem[];
}

export interface ConfigFile {
  options: OptionsState;
  plugins: PersistedPlugin[];
  activePreset: Preset;
}

export interface PluginsState {
  items: PluginInfo[];
}

export interface RuntimeState {
  layout: LayoutState;
  nodes: Record<string, ScElementNode>;
  savedTrees: Record<string, ScElementNodeBase>;
}

export interface RootState {
  isRunning: boolean;
  options: OptionsState;
  scsynth: ScsynthState;
  plugins: PluginsState;
  runtime: RuntimeState;
}

export type RootOwnAction = SliceActions<typeof rootSlice.actions>;
export type OptionsAction = SliceActions<typeof optionsSlice.actions>;
export type ScsynthAction = SliceActions<typeof scsynthSlice.actions>;
export type LayoutAction = SliceActions<typeof layoutSlice.actions>;
export type PluginsAction = SliceActions<typeof pluginsSlice.actions>;
export type RuntimeAction = SliceActions<typeof runtimeSlice.actions>;
export type RootAction = RootOwnAction | OptionsAction | ScsynthAction | LayoutAction | PluginsAction | RuntimeAction;
