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

export const OSC_MESSAGES = {
  STATUS: '/status',
  DUMP_OSC: '/dumpOSC',
  NOTIFY: '/notify',
  VERSION: '/version',
  SYNTH_NEW: '/s_new',
  GROUP_NEW: '/g_new',
  GROUP_TAIL: '/g_tail',
  GROUP_FREE_ALL: '/g_freeAll',
  NODE_FREE: '/n_free',
  NODE_RUN: '/n_run',
  NODE_SET: '/n_set',
  DEF_RECV: '/d_recv',
  BUF_ALLOC: '/b_alloc',
  BUF_FREE: '/b_free',
  BUF_GETN: '/b_getn',
} as const;

export const OSC_REPLIES = {
  STATUS: '/status.reply',
  VERSION: '/version.reply',
  DONE: '/done',
} as const;

// ── Global clock infrastructure ──────────────────────────────────────────────
// The app-wide phase broadcaster synth (`__global_clock__`) runs at the head
// of the default group and publishes a Phasor on an audio bus plus periodic
// `/tr` messages. All phase-tracked buffer readers anchor to this clock
// instead of each spawning their own SendTrig.
//
// Mirrored in Rust at src-tauri/src/clock.rs — keep the three constants in
// sync by hand; drift will break the reader/broadcaster contract silently.
/** `SendTrig` id the broadcaster tags its phase reports with. Readers match
 *  `msg.args[1] === CLOCK_TRIGGER_ID` to extract the phase. Must not collide
 *  with any bufnum (which is what per-buffer SendTrig used to use). */
export const CLOCK_TRIGGER_ID = 4242;
/** Audio bus the broadcaster writes its Phasor onto. Consumer synthdefs
 *  (e.g. sc-test's recorder) read it via `In.ar(PHASE_BUS)` to drive their
 *  own `BufWr.phase`. Picked high enough not to collide with hardware in/out
 *  and typical plugin bus usage. */
export const PHASE_BUS = 1000;
/** `Phasor.end` — all phase-tracked buffers must have `frames === SHARED_FRAMES`
 *  so their `BufWr` writes wrap in step with the shared phase. Non-clocked
 *  buffers (sc-buffer + RecordBuf, wall-clock mode) are unaffected. */
export const SHARED_FRAMES = 8192;

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

