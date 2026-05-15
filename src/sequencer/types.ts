/**
 * Public types for the step sequencer (Phase 27).
 *
 * The sequencer drives SuperDirt by emitting `/dirt/play` events at
 * step boundaries. Step times are anchored to `ClockController.tick0Ms`
 * + `tickRate` (not `performance.now()`) so playback stays
 * sample-accurate against the audio engine's clock — see the
 * Phase 27 plan for the rationale.
 */

/** Pattern length in steps. Power-of-two only — keeps the grid
 *  visually clean and aligns with the conventional 4/4 bar
 *  structure (subdivision 4 = 1/16ths). */
export type PatternLength = 8 | 16 | 32;
export const PATTERN_LENGTHS: ReadonlyArray<PatternLength> = [8, 16, 32];

/** Per-step / per-track parameter set (Phase 27b). The four
 *  parameters cover the most common SuperDirt mods that aren't
 *  already track-level (`gain`, `s`):
 *  - `amp`   — linear amplitude. SuperDirt's default is 0.4.
 *  - `cutoff`— low-pass filter cutoff Hz. Bypassed when omitted.
 *  - `speed` — playback speed multiplier (also pitch-shifts).
 *  - `pan`   — stereo position (0=L, 0.5=center, 1=R).
 *
 *  More can be added later (e.g. `room`, `delay`); the resolution
 *  pipeline doesn't care about the key set as long as it lines up
 *  between defaults + overrides. */
export const PARAM_NAMES = ['amp', 'cutoff', 'speed', 'pan'] as const;
export type ParamName = (typeof PARAM_NAMES)[number];

/** Sparse param map: only set keys are sent. An undefined value at
 *  a given key means "fall through" — to the track default, then
 *  to SuperDirt's built-in default. */
export type ParamMap = Partial<Record<ParamName, number>>;

/** UI metadata + slider config for each param. The slider's
 *  `default` is what we pre-fill the slider with when the user
 *  enables an override on a previously-unset parameter — i.e.
 *  it's the *starting point* for editing, not what gets sent
 *  when the override is cleared. */
export interface ParamSpec {
  name: ParamName;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Pre-fill value when the user creates an override for the
   *  first time. Chosen to be a sensible "no-op" or center
   *  position. */
  default: number;
}

export const PARAM_SPECS: ReadonlyArray<ParamSpec> = [
  { name: 'amp', label: 'amp', min: 0, max: 2, step: 0.01, default: 1 },
  { name: 'cutoff', label: 'cutoff', min: 100, max: 8000, step: 10, default: 800 },
  { name: 'speed', label: 'speed', min: 0.25, max: 4, step: 0.01, default: 1 },
  { name: 'pan', label: 'pan', min: 0, max: 1, step: 0.01, default: 0.5 },
];

/** A single step in a track. Active = fire `/dirt/play` at this
 *  step. `params` is sparse — present keys override the track's
 *  default, missing keys inherit from track default → SuperDirt
 *  default. The whole `params` object is omitted (not just empty)
 *  when there are no overrides, so `Object.keys(step.params).length`
 *  in the UI directly counts overrides. */
export interface Step {
  active: boolean;
  params?: ParamMap;
}

/** A single sequencer track. `steps.length` always equals
 *  `pattern.length`; resizing the pattern resizes every track's
 *  steps array (truncate or pad with empty inactive steps). */
export interface Track {
  /** Stable id for React keys + lookup; not exposed to OSC. */
  id: string;
  /** SuperDirt sample-bank name (e.g. `"bd"`, `"sn"`, `"808bd"`).
   *  Empty string = track is silent (sends nothing). */
  sample: string;
  /** 0..1 gain. Sent on every `/dirt/play` as the `gain` event
   *  param. SuperDirt's default gain is around 1.0; we bias to
   *  0.8 so unattended tracks don't clip when stacked. */
  gain: number;
  /** Track-level default values for the per-step params. Sparse:
   *  unset keys fall through to SuperDirt's defaults. Per-cell
   *  overrides win over these. */
  defaults: ParamMap;
  /** Step on/off + per-step param overrides. */
  steps: Step[];
}

/** Top-level pattern structure. Editable via SequencerController
 *  methods (immutable update inside; UI just calls
 *  `controller.toggleStep(trackId, i)` etc.).
 *
 *  BPM lives on the centralized `MetronomeController`, not on the
 *  pattern. Older saved patterns may still carry a `bpm` field in
 *  localStorage; PatternBank's sanitiser ignores it. */
export interface Pattern {
  /** 8 / 16 / 32 (see `PATTERN_LENGTHS`). */
  length: PatternLength;
  /** Tracks in display order. New tracks append at the bottom. */
  tracks: Track[];
  /** Steps per beat. Default 4 (= sixteenth notes in 4/4).
   *  Could become user-editable in a future phase. */
  subdivision: number;
}

/** Reactive transport state. `currentStep` updates exactly at the
 *  audible step boundary (delayed `setTimeout` from the scheduler),
 *  so the playhead matches the kick, not the lookahead horizon. */
export interface TransportState {
  isPlaying: boolean;
  /** 0..pattern.length-1 while playing; -1 while stopped. */
  currentStep: number;
}

/** One entry in the chain (Phase 27d). The chain plays each entry
 *  for `cycles` full passes through its slot's pattern, then
 *  advances to the next entry. */
export interface ChainEntry {
  /** 0..SLOT_COUNT-1 — index into `bank.slots`. */
  slotIndex: number;
  /** ≥ 1. How many full pattern cycles to spend on this entry. */
  cycles: number;
}

/** Chain configuration. Lives on the bank; persisted to
 *  localStorage alongside `slots` + `activeIndex`. */
export interface ChainState {
  /** When `enabled` + `steps.length > 0`, `play()` engages chain
   *  mode — the controller advances `bank.activeIndex` through
   *  `steps` at cycle boundaries. With either condition unmet,
   *  playback loops the user-selected slot as in 27a..c. */
  enabled: boolean;
  /** When the chain reaches the end: loop to step 0 (true) or
   *  stop playback (false). */
  loop: boolean;
  /** Ordered chain entries. */
  steps: ChainEntry[];
}

export function makeEmptyChain(): ChainState {
  return { enabled: false, loop: true, steps: [] };
}

/** What the scheduler needs from a `ClockController`. Defined as
 *  an interface so the scheduler is testable without a real clock
 *  / scsynth round-trip. Extended in Phase 32 with `chunkSize` /
 *  `sampleRate` so the controller can build the
 *  `SequencerClockSnapshot` it ships to the worker pump. */
export interface ClockLike {
  /** JS ms timestamp at which "tick 0" notionally happened (the
   *  audio engine's clock anchor). `null` until the first tick
   *  arrives. */
  readonly tick0Ms: number | null;
  /** Ticks per second (`sampleRate / chunkSize`). */
  readonly tickRate: number;
  /** Audio frames per tick (sclang's `SC_APP_CLOCK_CHUNK_SIZE`). */
  readonly chunkSize: number;
  /** scsynth's nominal sample rate from `/clock/info`. */
  readonly sampleRate: number;
}

/** Helpers — building blocks for both the controller and the
 *  scheduler. */

export function makeEmptyStep(): Step {
  return { active: false };
}

export function makeEmptyTrack(length: PatternLength, sample = ''): Track {
  return {
    id: makeTrackId(),
    sample,
    gain: 0.8,
    defaults: {},
    steps: Array.from({ length }, makeEmptyStep),
  };
}

export function makeEmptyPattern(length: PatternLength = 16): Pattern {
  return {
    length,
    tracks: [],
    subdivision: 4,
  };
}

/** True if a step has any param overrides set. Used by the UI to
 *  draw the "modified" dot inside the cell. */
export function stepHasOverrides(step: Step): boolean {
  if (!step.params) return false;
  for (const key of PARAM_NAMES) {
    if (step.params[key] !== undefined) return true;
  }
  return false;
}

/** Resolve a param's effective value at a given step:
 *  per-cell override → track default → undefined (= omit). */
export function resolveParam(
  track: Track,
  step: Step,
  name: ParamName,
): number | undefined {
  return step.params?.[name] ?? track.defaults[name];
}

let trackIdCounter = 0;
function makeTrackId(): string {
  trackIdCounter += 1;
  return `track-${trackIdCounter}`;
}
