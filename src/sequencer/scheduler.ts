/**
 * Sequencer scheduling logic — extracted from SequencerController
 * so it's testable in isolation against a fake ClockLike +
 * DirtClientLike.
 *
 * The wake-up loop is anchored to the audio engine's clock
 * (`ClockController.tick0Ms` + `tickRate`), not `performance.now()`.
 * Each fire ships an OSC bundle stamped via `tickToTimetag` so
 * SuperDirt schedules the event at a sample-accurate boundary;
 * the JS lookahead just keeps events on the wire ahead of their
 * fire time.
 */

import { tickToTimetag } from '@sc-app/server-commands';

import {
  PARAM_NAMES,
  resolveParam,
  type ClockLike,
  type DirtClientLike,
  type Pattern,
  type Step,
  type Track,
} from './types';

/**
 * How far ahead of "now" we initially schedule the first step
 * when Play is hit. Gives the bundle time to traverse JS →
 * worker → WS → bridge → UDP → SuperDirt → schedule queue
 * before its fire time.
 */
export const INITIAL_LOOKAHEAD_TICKS = 5;

/**
 * On each wake-up, schedule any step whose tick falls within
 * `[now, now + LOOKAHEAD_HORIZON_TICKS]`. Larger ⇒ more events on
 * SuperDirt's queue at a time (more resilient to JS stalls).
 * Smaller ⇒ more responsive to BPM / pattern changes.
 *
 * 5 ticks at chunkSize 1024 / 48 k tickRate ≈ 47 Hz ⇒ ~106 ms.
 */
export const LOOKAHEAD_HORIZON_TICKS = 5;

export interface SchedulerCallbacks {
  /** Called when the playhead lands on a step boundary, with the
   *  step index in `[0, pattern.length)`. Fires from a delayed
   *  `setTimeout` aligned to the audible event, not the
   *  lookahead horizon. */
  onStep(stepIndex: number): void;
}

/** Mutable scheduler state, owned by the controller. */
export interface SchedulerState {
  /** Monotonic step counter. Increments forever; `% pattern.length`
   *  to get the displayed step index. Reset to 0 on Play. */
  nextStepIndex: number;
  /** Fractional tick at which the next step fires. Reset on Play
   *  to `(now + INITIAL_LOOKAHEAD_TICKS)`. Increments by
   *  `stepIntervalTicks(pattern)` each fire. */
  nextStepTick: number;
  /** Pending playhead-update timeout ids, so they can be cancelled
   *  on Stop / dispose. setTimeout returns a number in DOM lib
   *  (Node.js's NodeJS.Timeout overload doesn't apply here). */
  pendingPlayheadTimers: number[];
}

export function makeInitialSchedulerState(): SchedulerState {
  return {
    nextStepIndex: 0,
    nextStepTick: 0,
    pendingPlayheadTimers: [],
  };
}

/** Reset state for a fresh Play. Caller passes the current tick
 *  index so the first scheduled step lands far enough in the
 *  future for the bundle to traverse the wire. */
export function resetForPlay(state: SchedulerState, currentTickIndex: number): void {
  state.nextStepIndex = 0;
  state.nextStepTick = currentTickIndex + INITIAL_LOOKAHEAD_TICKS;
  cancelPendingPlayheadTimers(state);
}

export function cancelPendingPlayheadTimers(state: SchedulerState): void {
  for (const id of state.pendingPlayheadTimers) {
    window.clearTimeout(id);
  }
  state.pendingPlayheadTimers = [];
}

/** Steps per second in tick units, given pattern + clock. */
export function stepIntervalTicks(pattern: Pattern, tickRate: number): number {
  return (60 / pattern.bpm / pattern.subdivision) * tickRate;
}

/** Convert a Date.now() timestamp to the (fractional) tick index
 *  the audio engine's clock would report at that wall-clock moment.
 *  Inverse of `tickToTimetag` for a given anchor. */
export function nowTickIndex(clock: ClockLike, nowMs: number): number | null {
  if (clock.tick0Ms === null) return null;
  return ((nowMs - clock.tick0Ms) * clock.tickRate) / 1000;
}

/**
 * Single wake-up of the scheduler. Walks forward from
 * `state.nextStepTick` to the lookahead horizon, firing
 * `/dirt/play` for every active step in every track and arranging
 * for `onStep` to fire at the audible step time.
 *
 * Returns `false` if the clock isn't running yet (`tick0Ms` null);
 * the controller can use this to gate the Play button or wait.
 */
export function pump(
  pattern: Pattern,
  clock: ClockLike,
  dirtClient: DirtClientLike,
  state: SchedulerState,
  callbacks: SchedulerCallbacks,
): boolean {
  const tick0Ms = clock.tick0Ms;
  if (tick0Ms === null) return false;
  const nowMs = Date.now();
  const nowTick = ((nowMs - tick0Ms) * clock.tickRate) / 1000;
  const horizon = nowTick + LOOKAHEAD_HORIZON_TICKS;
  const intervalTicks = stepIntervalTicks(pattern, clock.tickRate);

  while (state.nextStepTick <= horizon) {
    const stepIndex = state.nextStepIndex % pattern.length;
    const targetTick = state.nextStepTick;
    const timetag = tickToTimetag(tick0Ms, targetTick, clock.tickRate);

    for (const track of pattern.tracks) {
      if (!track.sample) continue; // empty sample name ⇒ silent
      const step = track.steps[stepIndex];
      if (!step?.active) continue;
      dirtClient.playAtTimetag(eventForTrack(track, step), timetag);
    }

    // Playhead update: fire at the audible step time so the UI
    // matches the kick, not the lookahead horizon.
    const stepTimeMs = tick0Ms + (targetTick * 1000) / clock.tickRate;
    const delayMs = Math.max(0, stepTimeMs - nowMs);
    const timerId = window.setTimeout(() => {
      callbacks.onStep(stepIndex);
      // Drop our id from the pending list once fired.
      const idx = state.pendingPlayheadTimers.indexOf(timerId);
      if (idx >= 0) state.pendingPlayheadTimers.splice(idx, 1);
    }, delayMs);
    state.pendingPlayheadTimers.push(timerId);

    state.nextStepIndex += 1;
    state.nextStepTick += intervalTicks;
  }

  return true;
}

/** Build the OSC event payload for a step on a track. Always
 *  carries `s` (sample bank) and `gain` (track-level trim);
 *  per-step params layered in via `resolveParam` (cell override
 *  → track default → omit). Phase 27b. */
function eventForTrack(track: Track, step: Step): Record<string, string | number> {
  const event: Record<string, string | number> = {
    s: track.sample,
    gain: track.gain,
  };
  for (const name of PARAM_NAMES) {
    const value = resolveParam(track, step, name);
    if (value !== undefined) event[name] = value;
  }
  return event;
}
