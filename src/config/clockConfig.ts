/**
 * App-wide clock configuration. Two free parameters (`sampleRate`,
 * `tickRate`); everything else — `samplesPerTick`, recording ring,
 * tick interval — is derived from them. The derived values must be
 * integer-consistent; `deriveClock` throws on any mismatch so the
 * invariants never leak into runtime.
 *
 * Scope-specific parameters (`chunkSize`, `decimation`) live on each
 * `ScopeController` instance via `ScopeDetail` — see below — so
 * different scopes can run at different effective sample rates.
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
}

export interface ClockDerived {
  /** `sampleRate / tickRate`. Drives recording chunk size and scope
   *  alignment. Every per-scope `chunkSize × decimation` must equal
   *  this value (enforced by `validateScopeDetail`). */
  samplesPerTick: number;
  /** `samplesPerTick * 2` — double-buffered recording ring. */
  recordRingSize: number;
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
  return {
    samplesPerTick,
    recordRingSize: samplesPerTick * 2,
    tickIntervalMs: 1000 / params.tickRate,
  };
}

/**
 * Per-scope detail. Only `chunkSize` is a free choice — it must be a
 * positive divisor of the clock's `samplesPerTick`. The decimation
 * factor (how many audio samples scsynth's BufWr collapses into a
 * single buffer slot) is derived: `decimation = samplesPerTick /
 * chunkSize`. Together they satisfy the worker's invariant
 * `chunkSize × decimation = samplesPerTick`, which is what makes the
 * `completedHalf = tickIndex % 2` parity formula valid — the scope
 * synth's `writeIdx` wraps at every tick boundary, with one half
 * completed per tick.
 *
 * User mental model: pick how many samples per scope frame you want
 * (visual resolution / bandwidth trade-off); the engine handles the
 * decimation maths. Smaller `chunkSize` = larger `decimation` = more
 * aggressive zero-order-hold downsampling. Above the alias frequency
 * (`sampleRate / (2 × decimation)`) high-frequency content folds
 * back visibly — see the gotcha note in `CLAUDE.md`.
 */
export interface ScopeDetail {
  /** Samples per scope frame, per channel. Must divide
   *  `samplesPerTick`. */
  chunkSize: number;
}

/** Default scope detail — 256 samples per frame at the current
 *  1024-sample tick gives 12 kHz effective rate, comfortable for
 *  most audio content with ~1 KB/tick mono network traffic. */
export const SCOPE_DETAIL_DEFAULT: ScopeDetail = { chunkSize: 256 };

/** Derived: how many audio frames are collapsed into one buffer
 *  slot. The scope synth's writeIdx advances by 1 every
 *  `decimation` audio samples; the buffer holds `chunkSize × 2`
 *  slots so one half completes per tick. */
export function decimationFor(
  detail: ScopeDetail,
  samplesPerTick: number,
): number {
  return samplesPerTick / detail.chunkSize;
}

/** Validate that `chunkSize` divides `samplesPerTick` cleanly.
 *  Throws with a useful message if not — used at scope-controller
 *  construction so misconfigured detail never reaches the worker
 *  or scsynth. */
export function validateScopeDetail(
  detail: ScopeDetail,
  samplesPerTick: number,
): void {
  if (!Number.isInteger(detail.chunkSize) || detail.chunkSize < 1) {
    throw new Error(
      `ScopeDetail.chunkSize must be a positive integer, got ${detail.chunkSize}`,
    );
  }
  if (samplesPerTick % detail.chunkSize !== 0) {
    throw new Error(
      `ScopeDetail.chunkSize (${detail.chunkSize}) must divide ` +
        `samplesPerTick (${samplesPerTick}); decimation would be ` +
        `${samplesPerTick / detail.chunkSize} (non-integer)`,
    );
  }
}

/** Effective audio-rate sample rate seen by a scope after decimation —
 *  what `ScopeView` uses to compute the visible window in milliseconds. */
export function scopeEffectiveRate(
  env: AudioEnvironment,
  detail: ScopeDetail,
  samplesPerTick: number,
): number {
  return (env.sampleRate * detail.chunkSize) / samplesPerTick;
}

export const DEFAULT_ENV: AudioEnvironment = { sampleRate: 48000 };

// Power-of-2 derivation: 48000 / 46.875 = 1024 (page-aligned recording
// reads) and SCOPE_DETAIL_DEFAULT.chunkSize × decimation = 256 × 4 =
// 1024 = samplesPerTick. The scope's chunkSize and decimation are no
// longer global — they're per-scope. See `ScopeDetail`.
export const DEFAULT_PARAMS: ClockParams = {
  tickRate: 46.875,
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
