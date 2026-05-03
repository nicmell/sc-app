/**
 * App-wide clock configuration. Two free parameters per session:
 *
 * - `AudioEnvironment.sampleRate` is read at runtime from
 *   scsynth's `/status.reply` (`args[8]`) — never hardcoded. The
 *   only sanity check is that it's positive and finite.
 * - `ClockParams.chunkSize` is the global "samples per scope frame
 *   / per recording chunk / per /b_setn payload" knob, mutable from
 *   the dashboard header. Power-of-2 values keep buffers
 *   page-aligned and FFT-friendly. Tick rate is derived as
 *   `sampleRate / chunkSize` — no longer a free parameter.
 *
 * `samplesPerTick = chunkSize` directly (decimation is fixed at 1
 * everywhere). The double-buffered ring is `2 × chunkSize × channels`
 * floats, regardless of sampleRate.
 */

export interface AudioEnvironment {
  /** Reported by scsynth's `/status.reply.args[8]`. Drives every
   *  derived value in `ClockDerived`. */
  sampleRate: number;
}

export interface ClockParams {
  /** Samples per scope frame / per recording chunk. Power-of-2
   *  values from `CHUNK_SIZE_OPTIONS` recommended; `practicalChunkSizes`
   *  filters out values that would push the tick rate above
   *  `MAX_PRACTICAL_TICK_RATE`. */
  chunkSize: number;
}

export interface ClockDerived {
  /** = `chunkSize`. Drives buffer math + WAV alignment. */
  samplesPerTick: number;
  /** = `sampleRate / chunkSize`. Free-running Hz; need not be
   *  integer. `Impulse.kr` quantises to kr blocks regardless. */
  tickRate: number;
  /** = `2 × chunkSize`. Recording's `Phasor.ar` wraps here. */
  recordRingSize: number;
  /** = `1000 / tickRate`. Used by UI watchdogs. */
  tickIntervalMs: number;
}

export function deriveClock(
  env: AudioEnvironment,
  params: ClockParams,
): ClockDerived {
  // sampleRate must be a positive integer — `WavMemoryWriter`
  // stamps it into the WAV header (uint32 field) and downstream
  // tools assume integer Hz. AppShell rounds the nominal rate
  // returned by scsynth's /status.reply before passing it here,
  // but we re-check at the boundary so a future caller can't
  // sneak a float in.
  if (!Number.isInteger(env.sampleRate) || env.sampleRate <= 0) {
    throw new Error(
      `deriveClock: sampleRate must be a positive integer, got ${env.sampleRate}`,
    );
  }
  if (!Number.isInteger(params.chunkSize) || params.chunkSize < 1) {
    throw new Error(
      `deriveClock: chunkSize must be a positive integer, got ${params.chunkSize}`,
    );
  }
  return {
    samplesPerTick: params.chunkSize,
    tickRate: env.sampleRate / params.chunkSize,
    recordRingSize: params.chunkSize * 2,
    tickIntervalMs: (params.chunkSize * 1000) / env.sampleRate,
  };
}

/** Default chunkSize when the dashboard first connects. At
 *  `sampleRate = 48000` this gives `tickRate = 46.875 Hz` and a
 *  21.33 ms scope window. See CLAUDE.md for the
 *  chunkSize × sampleRate reference table. */
export const DEFAULT_PARAMS: ClockParams = { chunkSize: 1024 };

/** All chunk-size choices the header dropdown ever offers. Each is
 *  a power of 2 — preserves FFT-readiness (Future Improvement #15)
 *  and page alignment. `practicalChunkSizes` filters this list per
 *  session against the sampleRate scsynth reports. */
export const CHUNK_SIZE_OPTIONS = [1024, 512, 256, 128, 64] as const;

/** Above this tick rate the `/b_setn` round-trip starts crowding
 *  the next-tick boundary (the Phase 12 gap-bug pattern), and
 *  scsynth's kr block resolution caps how often `Impulse.kr` can
 *  meaningfully fire (`sampleRate / 64` Hz). 250 Hz is a
 *  comfortable headroom — well above typical UI refresh, well
 *  below where things get fragile. */
export const MAX_PRACTICAL_TICK_RATE = 250;

/** Filter `CHUNK_SIZE_OPTIONS` to those that produce a tick rate
 *  within `MAX_PRACTICAL_TICK_RATE`. At 48 kHz / 44.1 kHz all
 *  values pass; at 96 kHz the smaller values drop out; at 192 kHz
 *  only `1024` survives. */
export function practicalChunkSizes(
  sampleRate: number,
): readonly number[] {
  return CHUNK_SIZE_OPTIONS.filter(
    (cs) => sampleRate / cs <= MAX_PRACTICAL_TICK_RATE,
  );
}

/** Reserved SendTrig ID for the global clock synth. No other synth
 *  may use this id — it's the worker's dispatch key. */
export const CLOCK_TRIG_ID = 1000;

/** How many ticks the clock's audio-rate sample phasor covers before
 *  wrapping. The value `2` implements the double-buffering convention
 *  every downstream consumer (scopes, recorders) relies on: at each
 *  tick, exactly one half-ring of each consumer's buffer has
 *  completed. Any consumer whose ring size divides
 *  `CLOCK_WRAP_TICKS × samplesPerTick` sees clean wraps. */
export const CLOCK_WRAP_TICKS = 2;

/** How far in the future the worker schedules each `/b_getn` after
 *  receiving a `/tr`, expressed as a JS-ms offset added to
 *  `Date.now()`.
 *
 *  This value clears the **kr-vs-ar drift (~1.3 ms)** between the
 *  `Impulse.kr`-driven `/tr` (kr-quantised, ≤ 64 ar samples late)
 *  and the `Phasor.ar`-driven `writeIdx` (exact half-boundary). If
 *  `/b_getn` arrives at scsynth before the half has fully been
 *  written, the read includes stale tail samples. 5 ms of cushion
 *  is comfortable.
 *
 *  Why not bump higher to silence scsynth's `late 0.0XX` warnings?
 *  Two constraints conflict at default chunkSize:
 *
 *  - **No `late` warnings**: requires `READ_DELAY >= scsynth's
 *    audio-clock-vs-wall-clock drift` (~14–24 ms in practice).
 *  - **No buffer-overwrite gaps**: requires `READ_DELAY <= one
 *    tick interval`, since the ring is 2 halves wide
 *    (`ringFrames = 2 × chunkSize`). At chunkSize=1024 / sr=48 k
 *    that's only 21.3 ms.
 *
 *  No value satisfies both. We pick correctness — accept the
 *  cosmetic `late` warnings on `/b_getn`; scsynth still runs the
 *  read at the right audio frame, just logs a "ran late" notice
 *  because our wall-clock-derived timetag is in its audio past.
 *  Bumping the chunkSize from the dashboard widens the tick
 *  interval and would allow a higher value here, but the constant
 *  is global so we tune for the smallest practical chunkSize. */
export const READ_DELAY_MS = 5;
