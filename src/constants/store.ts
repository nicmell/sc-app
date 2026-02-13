import type {ScsynthOptions, ScsynthStatus} from "@/types/stores";
import type {LayoutItem} from "react-grid-layout";

export const DEFAULT_POLL_STATUS_MS = 1000;

export const DEFAULT_NODE_ID = 1000;

export const ConnectionStatus = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
} as const;

export const ADDRESS_REGEXP = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})$/;

export const DEFAULT_CLIENT_ID = -1;

export const DEFAULT_VERSION = "";

export const DEFAULT_STATUS: ScsynthStatus = {
  ugens: 0,
  synths: 0,
  groups: 0,
  defs: 0,
  avgCpu: 0,
  peakCpu: 0,
  sampleRate: 0,
};

export const DEFAULT_OPTIONS: ScsynthOptions = {
  host: "127.0.0.1",
  port: 57110,
  initialNodeId: DEFAULT_NODE_ID,
  pollStatusMs: DEFAULT_POLL_STATUS_MS,
};

export const DEFAULT_LAYOUT: LayoutItem[] = [
  {i: "server", x: 0, y: 0, w: 6, h: 3},
  {i: "synth", x: 6, y: 0, w: 6, h: 3},
  {i: "log", x: 0, y: 3, w: 12, h: 4},
];
