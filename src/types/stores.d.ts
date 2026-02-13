import type {LayoutItem} from "react-grid-layout";

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
  setClient: (clientId: number) => void;
  setOptions: (options: Partial<ScsynthOptions>) => void;
  setConnectionStatus: (connectionStatus: ConnectionStatus) => void;
  setStatus: (status: ScsynthStatus) => void;
  setVersion: (version: string) => void;
  clearClient: () => void;
}

export interface LayoutState {
  layout: LayoutItem[];
  setLayout: (layout: LayoutItem[]) => void;
  resetLayout: () => void;
}

export interface ThemeState {
  mode: Mode;
  primaryColor: string;
  setMode: (mode: Mode) => void;
  setPrimaryColor: (color: string) => void;
}

export interface RootState {
  theme: ThemeState;
  layout: LayoutState;
  scsynth: ScsynthState;
}
