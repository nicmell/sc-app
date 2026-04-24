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

export const DEFAULT_PARAMS: ClockParams = {
  tickRate: 48,
  scopeChunkSize: 250,
  decimation: 4,
};

/** Reserved SendTrig ID for the global clock synth. No other synth
 *  may use this id — it's the worker's dispatch key. */
export const CLOCK_TRIG_ID = 1000;

/** Reserved SendTrig ID for the dev phase-probe synth. Used only
 *  by `ClockController.probePhase`. */
export const PHASE_PROBE_TRIG_ID = 9001;

/** How many ticks the clock's audio-rate sample phasor covers before
 *  wrapping. The value `2` implements the double-buffering convention
 *  every downstream consumer (scopes, recorders) relies on: at each
 *  tick, exactly one half-ring of each consumer's buffer has
 *  completed. Any consumer whose ring size divides
 *  `CLOCK_WRAP_TICKS × samplesPerTick` sees clean wraps. */
export const CLOCK_WRAP_TICKS = 2;
