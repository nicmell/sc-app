/**
 * App-wide clock configuration. Three free parameters (`sampleRate`,
 * `tickRate`, `scopeChunkSize`, `decimation`); everything else —
 * ring sizes, scope window, tick interval — is derived from them.
 * The derived values must be integer-consistent; `deriveClock`
 * throws on any mismatch so the invariants never leak into runtime.
 *
 * This module is the ONLY place where the numeric defaults appear.
 */

export interface AudioEnvironment {
  /** Fixed by scsynth boot. Must divide evenly by `tickRate`. */
  sampleRate: number;
}

export interface ClockParams {
  /** Control-rate tick frequency in Hz. */
  tickRate: number;
  /** Samples per scope frame, per channel. */
  scopeChunkSize: number;
  /** Scope-only audio-sample downsampling factor. */
  decimation: number;
}

export interface ClockDerived {
  /** `sampleRate / tickRate`. Drives recording chunk size and scope alignment. */
  samplesPerTick: number;
  /** `scopeChunkSize * 2` — double-buffered ring. */
  scopeRingSize: number;
  /** `samplesPerTick * 2` — double-buffered recording ring. */
  recordRingSize: number;
  /** Visible scope window in seconds. */
  scopeWindowSeconds: number;
  /** Effective post-decimation sample rate for scope rendering. */
  scopeEffectiveRate: number;
  /** Nominal tick period in ms — used by UI watchdogs. */
  tickIntervalMs: number;
}

export function deriveClock(
  env: AudioEnvironment,
  params: ClockParams,
): ClockDerived {
  const samplesPerTick = env.sampleRate / params.tickRate;
  if (!Number.isInteger(samplesPerTick)) {
    throw new Error(
      `sampleRate (${env.sampleRate}) / tickRate (${params.tickRate}) must be integer`,
    );
  }
  if (params.scopeChunkSize * params.decimation !== samplesPerTick) {
    throw new Error(
      `scopeChunkSize (${params.scopeChunkSize}) × decimation (${params.decimation}) ` +
        `must equal samplesPerTick (${samplesPerTick})`,
    );
  }
  return {
    samplesPerTick,
    scopeRingSize: params.scopeChunkSize * 2,
    recordRingSize: samplesPerTick * 2,
    scopeWindowSeconds:
      (params.scopeChunkSize * params.decimation) / env.sampleRate,
    scopeEffectiveRate: env.sampleRate / params.decimation,
    tickIntervalMs: 1000 / params.tickRate,
  };
}

export const DEFAULT_ENV: AudioEnvironment = { sampleRate: 48000 };

// Power-of-2 derived values for FFT-friendliness and page-aligned
// recording reads (1024 frames × 4 bytes = one OS page). The
// invariants `sampleRate / tickRate ∈ ℤ` and `chunkSize × decimation
// = samplesPerTick` are enforced by `deriveClock()`:
//   48000 / 46.875 = 1024 ✓
//   256 × 4 = 1024 ✓
export const DEFAULT_PARAMS: ClockParams = {
  tickRate: 46.875,
  scopeChunkSize: 256,
  decimation: 4,
};

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
 *  The `/tr` fires from `Impulse.kr` which is kr-quantised to a
 *  control-block boundary (≤ 64 ar samples ≈ 1.3 ms of jitter at
 *  sr 48 k), but the scope's `writeIdx` advances at ar rate against
 *  an exactly-aligned `Phasor.ar` wrap. If `/b_getn` arrives at
 *  scsynth before the targeted half has fully been written, the
 *  read includes a few "stale" samples from the previous cycle and
 *  the chunk shows a step at the boundary.
 *
 *  Wrapping `/b_getn` in an `OSC.Bundle` with timetag
 *  `Date.now() + READ_DELAY_MS` lets scsynth's scheduler hold the
 *  read until well past the worst-case kr-vs-ar drift (~1.3 ms),
 *  guaranteeing a clean read. 5 ms is comfortable; tune up if you
 *  ever see remaining artefacts, down if the added latency matters. */
export const READ_DELAY_MS = 5;
