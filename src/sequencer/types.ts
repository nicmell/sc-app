/**
 * Public types for the step sequencer (Phase 27).
 *
 * The sequencer drives SuperDirt by emitting `/dirt/play` events at
 * step boundaries. Step times are anchored to `ClockController.tick0Ms`
 * + `tickRate` (not `performance.now()`) so playback stays
 * sample-accurate against the audio engine's clock — see the
 * Phase 27 plan for the rationale.
 */

import type { Timetag } from '@sc-app/server-commands';

/** Pattern length in steps. Power-of-two only — keeps the grid
 *  visually clean and aligns with the conventional 4/4 bar
 *  structure (subdivision 4 = 1/16ths). */
export type PatternLength = 8 | 16 | 32;
export const PATTERN_LENGTHS: ReadonlyArray<PatternLength> = [8, 16, 32];

/** A single sequencer track. `steps.length` always equals
 *  `pattern.length`; resizing the pattern resizes every track's
 *  steps array (truncate or pad with `false`). */
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
  /** Step on/off. `steps[i] === true` ⇒ fire `/dirt/play` at step
   *  `i`. */
  steps: boolean[];
}

/** Top-level pattern structure. Editable via SequencerController
 *  methods (immutable update inside; UI just calls
 *  `controller.toggleStep(trackId, i)` etc.). */
export interface Pattern {
  /** 8 / 16 / 32 (see `PATTERN_LENGTHS`). */
  length: PatternLength;
  /** Tracks in display order. New tracks append at the bottom. */
  tracks: Track[];
  /** Beats per minute. 60..240; default 120. */
  bpm: number;
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

/** What the scheduler needs from a `ClockController`. Defined as
 *  an interface so the scheduler is testable without a real clock
 *  / scsynth round-trip. */
export interface ClockLike {
  /** JS ms timestamp at which "tick 0" notionally happened (the
   *  audio engine's clock anchor). `null` until the first tick
   *  arrives. */
  readonly tick0Ms: number | null;
  /** Ticks per second (`sampleRate / chunkSize`). */
  readonly tickRate: number;
}

/** What the scheduler needs from a `DirtClient`. */
export interface DirtClientLike {
  playAtTimetag(event: Record<string, string | number>, timetag: Timetag): void;
}

/** Helpers — building blocks for both the controller and the
 *  scheduler. */

export function makeEmptyTrack(length: PatternLength, sample = ''): Track {
  return {
    id: makeTrackId(),
    sample,
    gain: 0.8,
    steps: new Array<boolean>(length).fill(false),
  };
}

export function makeEmptyPattern(length: PatternLength = 16): Pattern {
  return {
    length,
    tracks: [],
    bpm: 120,
    subdivision: 4,
  };
}

let trackIdCounter = 0;
function makeTrackId(): string {
  trackIdCounter += 1;
  return `track-${trackIdCounter}`;
}
