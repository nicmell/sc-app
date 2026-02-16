import type {ScsynthOptions, ScsynthStatus} from "@/types/stores";

export const DEFAULT_HOST = "127.0.0.1";

export const DEFAULT_PORT = 57110;

export const DEFAULT_POLL_STATUS_MS = 1000;

export const DEFAULT_REPLY_TIMEOUT_MS = 3000;

export const DEFAULT_MSG_LATENCY_MS = 200;

export const DEFAULT_CLIENT_ID = -1;

export const ConnectionStatus = {
  DISCONNECTED: "disconnected",
  CONNECTING: "connecting",
  CONNECTED: "connected",
} as const;

export const ADDRESS_REGEXP = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})$/;


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
  host: DEFAULT_HOST,
  port: DEFAULT_PORT,
  clientId: DEFAULT_CLIENT_ID,
  pollStatusMs: DEFAULT_POLL_STATUS_MS,
  replyTimeoutMs: DEFAULT_REPLY_TIMEOUT_MS,
  msgLatencyMs: DEFAULT_MSG_LATENCY_MS,
};

