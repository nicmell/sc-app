import type {StateCreator} from "zustand";
import {ConnectionStatus, DEFAULT_NODE_ID, DEFAULT_POLL_STATUS_MS} from "@/lib/constants";

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

const DEFAULT_CLIENT_ID = 0;
const DEFAULT_VERSION = "";

const DEFAULT_STATUS: ScsynthStatus = {
  ugens: 0,
  synths: 0,
  groups: 0,
  defs: 0,
  avgCpu: 0,
  peakCpu: 0,
  sampleRate: 0,
};

const DEFAULT_OPTIONS: ScsynthOptions = {
  host: "127.0.0.1",
  port: 57110,
  initialNodeId: DEFAULT_NODE_ID,
  pollStatusMs: DEFAULT_POLL_STATUS_MS,
};

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

export const scsynthSlice: StateCreator<ScsynthState> = (set) => ({
  clientId: DEFAULT_CLIENT_ID,
  options: DEFAULT_OPTIONS,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  status: DEFAULT_STATUS,
  version: DEFAULT_VERSION,
  setClient: (clientId) => set({clientId, connectionStatus: ConnectionStatus.CONNECTED}),
  setOptions: (opts) => set((state) => ({options: {...state.options, ...opts}})),
  setConnectionStatus: (connectionStatus) => set({connectionStatus}),
  setStatus: (status) => set({status}),
  setVersion: (version) => set({version}),
  clearClient: () => set({
    clientId: DEFAULT_CLIENT_ID,
    connectionStatus: ConnectionStatus.DISCONNECTED,
    status: DEFAULT_STATUS,
    version: DEFAULT_VERSION,
  }),
});
