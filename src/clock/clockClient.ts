/**
 * Typed builders + reply parsers for the Phase 30 shared-clock OSC
 * surface. The clock lives in sclang (see
 * `scripts/sc-app-superdirt-startup.scd`'s `\scAppClock` SynthDef
 * + `\scAppClockHello` OSCdef); this module is the matching
 * frontend wire format.
 *
 * Two addresses:
 *
 *   - `/clock/hello`  — frontend → sclang. Empty args. Replies
 *                       with `/clock/info`.
 *   - `/clock/info`   — sclang → frontend. Interleaved
 *                       `[key, value, key, value, …]` payload (same
 *                       wire shape as `/dirt/samples`) so the
 *                       responder side stays one `addr.sendMsg` call.
 *
 * The bridge routes both prefixes to sclang's UDP port via the
 * `/clock → 127.0.0.1:57120` entry in `config.json`.
 */

import OSC from 'osc-js';
import type { OscArg } from '@sc-app/server-commands';

// ── Outgoing message builders ────────────────────────────────────────

export function clockHello(): OSC.Message {
  return new OSC.Message('/clock/hello');
}

// ── Reply addresses ──────────────────────────────────────────────────

export const CLOCK_INFO_REPLY = '/clock/info';

/** sclang's `\scAppClock` SynthDef emits this address via
 *  `SendReply.kr(tick, '/clock/tick', count)` once per audio tick.
 *  Wire shape: `nodeID replyID count` (replyID is SendReply's
 *  default -1; we don't use it). The OSC worker decodes by address
 *  match and emits a `clockTick` event to the main thread. */
export const CLOCK_TICK_REPLY = '/clock/tick';

// ── Reply parser ─────────────────────────────────────────────────────

/** Decoded `/clock/info` payload. Every field is required — sclang's
 *  responder always emits the full set, so a missing key indicates
 *  a protocol mismatch worth surfacing. */
export interface ClockInfo {
  /** Hz. Equal to `sampleRate / chunkSize`. May be fractional. */
  tickRate: number;
  /** Audio frames per tick. Power-of-2 in the supported range. */
  chunkSize: number;
  /** scsynth's nominal sample rate, captured at sclang's
   *  `s.doWhenBooted` time. Integer Hz. */
  sampleRate: number;
  /** Phase 36: audio bus index the `\scAppClock` synth writes a
   *  sample-counting `Phasor.ar` to. Read by the OSC-fallback tap
   *  SynthDef (`bufferTapOscSynthDef`) to derive a sample-aligned
   *  ring-buffer `writeIdx`. SHM mode ignores this. */
  clockBus: number;
  /** scsynth nodeId of the running `\scAppClock` synth. Reserved
   *  by convention — clients must not `/n_free` it. */
  clockNodeId: number;
}

/** Parse a `/clock/info` reply's `args` array. The wire shape is
 *  `[key1, value1, key2, value2, …]` — same as `/dirt/samples`.
 *  Throws on missing required keys so a sclang ↔ frontend protocol
 *  mismatch fails loudly rather than silently producing NaNs. */
export function parseClockInfo(args: readonly OscArg[]): ClockInfo {
  const map = new Map<string, OscArg>();
  for (let i = 0; i + 1 < args.length; i += 2) {
    const key = args[i];
    if (typeof key !== 'string') continue;
    map.set(key, args[i + 1]);
  }

  const num = (key: string): number => {
    const v = map.get(key);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(
        `/clock/info: missing or non-numeric "${key}" (got ${JSON.stringify(v)})`,
      );
    }
    return v;
  };

  return {
    tickRate: num('tickRate'),
    chunkSize: num('chunkSize'),
    sampleRate: num('sampleRate'),
    clockBus: num('clockBus'),
    clockNodeId: num('clockNodeId'),
  };
}
