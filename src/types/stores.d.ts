import type {SliceActions} from "@/lib/stores/utils";
import type {scsynthSlice} from "@/lib/stores/scsynth/slice";
import type {layoutSlice} from "@/lib/stores/layout/slice";
import type {themeSlice} from "@/lib/stores/theme/slice";
import type {pluginsSlice} from "@/lib/stores/plugins/slice";
import type {nodesSlice} from "@/lib/stores/nodes/slice";

export interface BoxItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  plugin?: string;
  // Runtime-only (not persisted)
  loaded?: boolean;
  error?: string;
}

export type PersistedBoxItem = Omit<BoxItem, 'loaded' | 'error'>;

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
  nodes: NodesState
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

export interface InputElement {
  type: 'input';
  id: string;
  value: any;
}

export interface UGenElement {
  type: 'ugen';
  id: string;
  ugen: string;
  rate: string;
  inputs: Record<string, any>;
}

export interface SynthElement {
  id: string;
  type: 'synth';
  nodeId: number;
  groupId: number;
  isRunning: boolean;
  elements: AnyElement[];
}

export interface GroupElement {
  id: string;
  type: 'group';
  nodeId: number;
  groupId: number;
  elements: AnyElement[];
}

export type NodeElement = SynthElement | GroupElement;

export type AnyElement = InputElement | UGenElement | NodeElement;

export interface NodesState {
  items: NodeElement[];
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
export type NodesAction = SliceActions<typeof nodesSlice.actions>;
export type RootAction = ScsynthAction | LayoutAction | ThemeAction | PluginsAction | NodesAction;
