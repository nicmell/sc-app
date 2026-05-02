/**
 * Step-sequencer controller (Phase 27).
 *
 * Owns the transport + JS wake-up loop and exposes a thin
 * mutation API over the active pattern. Drives SuperDirt via the
 * existing `DirtClient`. Anchors all timing to
 * `ClockController.tick0Ms` + `tickRate` so playback stays
 * sample-accurate against the audio engine's clock; the JS
 * scheduler just keeps OSC bundles on the wire ahead of their
 * fire time.
 *
 * Phase 27c reshape: the controller no longer owns its own
 * `Pattern` store. Pattern state lives on the `PatternBank`
 * (8-slot reactive store with localStorage persistence); the
 * controller reads `bank.activePattern` and forwards mutations
 * back through `bank.updateActivePattern(...)`. Switching slots
 * (1..8 keys, or the panel's bank selector) takes effect at the
 * next pump — playback is intentionally NOT stopped on switch
 * so the user can A/B between patterns mid-loop.
 *
 * Lifecycle:
 * - Created in `setupDashboard`, given the live `clock`,
 *   `dirtClient`, and `bank`.
 * - `dispose()` stops playback + cancels pending playhead
 *   timeouts; safe to call multiple times. The bank itself is
 *   long-lived across re-init — disposed at the AppShell level.
 *
 * Pattern mutations are immutable: every method that touches the
 * pattern produces a new object reference, so `Object.is`-based
 * change detection (the reactive store) fires correctly.
 */

import { createStore, type ReadonlyStore } from '@/util/reactiveStore';

import type { PatternBank } from './PatternBank';
import {
  cancelPendingPlayheadTimers,
  makeInitialSchedulerState,
  pump,
  resetForPlay,
  type SchedulerState,
} from './scheduler';
import {
  makeEmptyStep,
  makeEmptyTrack,
  PARAM_NAMES,
  type ClockLike,
  type DirtClientLike,
  type ParamMap,
  type ParamName,
  type Pattern,
  type PatternLength,
  type Step,
  type TransportState,
} from './types';

/** How often the scheduler wakes up to schedule events. 25 ms ⇒
 *  40 Hz. Combined with `LOOKAHEAD_HORIZON_TICKS` this gives a
 *  generous safety margin against JS event-loop stalls. */
const WAKE_INTERVAL_MS = 25;

const STOPPED_TRANSPORT: TransportState = {
  isPlaying: false,
  currentStep: -1,
};

export interface SequencerControllerOptions {
  clock: ClockLike;
  dirtClient: DirtClientLike;
  /** Source of truth for pattern state. The controller never
   *  mutates other slots — only the active one. */
  bank: PatternBank;
}

export class SequencerController {
  private readonly clock: ClockLike;
  private readonly dirtClient: DirtClientLike;
  private readonly bank: PatternBank;

  private readonly _transport;
  private readonly schedulerState: SchedulerState;
  private wakeTimer: number | null = null;
  private disposed = false;

  constructor(opts: SequencerControllerOptions) {
    this.clock = opts.clock;
    this.dirtClient = opts.dirtClient;
    this.bank = opts.bank;
    this._transport = createStore<TransportState>(STOPPED_TRANSPORT);
    this.schedulerState = makeInitialSchedulerState();
  }

  /** Active pattern, sourced from the bank. The reactive store
   *  fires whenever the user mutates the active slot OR switches
   *  to a different slot — both flow through the bank's internal
   *  derivations. */
  readonly pattern: ReadonlyStore<Pattern> = {
    get: () => this.bank.activePattern.get(),
    subscribe: (cb) => this.bank.activePattern.subscribe(cb),
  };

  readonly transport: ReadonlyStore<TransportState> = {
    get: () => this._transport.get(),
    subscribe: (cb) => this._transport.subscribe(cb),
  };

  // ── Pattern mutations ──────────────────────────────────────────────

  addTrack(sample = ''): void {
    if (this.disposed) return;
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: [...p.tracks, makeEmptyTrack(p.length, sample)],
    }));
  }

  removeTrack(trackId: string): void {
    if (this.disposed) return;
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: p.tracks.filter((t) => t.id !== trackId),
    }));
  }

  setTrackSample(trackId: string, sample: string): void {
    if (this.disposed) return;
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, sample } : t)),
    }));
  }

  setTrackGain(trackId: string, gain: number): void {
    if (this.disposed) return;
    const clamped = Math.max(0, Math.min(2, gain));
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, gain: clamped } : t)),
    }));
  }

  toggleStep(trackId: string, stepIndex: number): void {
    if (this.disposed) return;
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        if (stepIndex < 0 || stepIndex >= t.steps.length) return t;
        const nextSteps = t.steps.slice();
        const cur = nextSteps[stepIndex];
        nextSteps[stepIndex] = { ...cur, active: !cur.active };
        return { ...t, steps: nextSteps };
      }),
    }));
  }

  /** Phase 27b — set a per-cell param override. Pass `undefined`
   *  via `clearStepParam` to drop the override (don't pass NaN /
   *  undefined here). The cell's `params` object is created on
   *  demand and dropped entirely when its last key clears, so
   *  `step.params === undefined` always means "no overrides". */
  setStepParam(
    trackId: string,
    stepIndex: number,
    name: ParamName,
    value: number,
  ): void {
    if (this.disposed) return;
    if (!Number.isFinite(value)) return;
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        if (stepIndex < 0 || stepIndex >= t.steps.length) return t;
        const nextSteps = t.steps.slice();
        const cur = nextSteps[stepIndex];
        const nextParams: ParamMap = { ...(cur.params ?? {}), [name]: value };
        nextSteps[stepIndex] = { ...cur, params: nextParams };
        return { ...t, steps: nextSteps };
      }),
    }));
  }

  /** Drop a per-cell override. If it was the only override the
   *  whole `params` object is dropped from the step (so
   *  `stepHasOverrides` short-circuits cleanly). */
  clearStepParam(trackId: string, stepIndex: number, name: ParamName): void {
    if (this.disposed) return;
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        if (stepIndex < 0 || stepIndex >= t.steps.length) return t;
        const cur = t.steps[stepIndex];
        if (!cur.params || cur.params[name] === undefined) return t;
        const { [name]: _dropped, ...rest } = cur.params;
        const nextSteps = t.steps.slice();
        nextSteps[stepIndex] = paramsObjectToStep(cur, rest);
        return { ...t, steps: nextSteps };
      }),
    }));
  }

  /** Drop ALL per-cell overrides on a step in one shot. Cheaper
   *  than four `clearStepParam` calls and avoids four reactive
   *  emits in a row. */
  clearAllStepParams(trackId: string, stepIndex: number): void {
    if (this.disposed) return;
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        if (stepIndex < 0 || stepIndex >= t.steps.length) return t;
        const cur = t.steps[stepIndex];
        if (!cur.params) return t;
        const nextSteps = t.steps.slice();
        const next: Step = { active: cur.active };
        nextSteps[stepIndex] = next;
        return { ...t, steps: nextSteps };
      }),
    }));
  }

  /** Set a track-level default for a param. Cells without an
   *  override inherit this. Passing the SuperDirt-default value
   *  does NOT short-circuit — the user explicitly said "this
   *  track should send pan=0.5", which is a different statement
   *  from "no override". */
  setTrackDefault(trackId: string, name: ParamName, value: number): void {
    if (this.disposed) return;
    if (!Number.isFinite(value)) return;
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, defaults: { ...t.defaults, [name]: value } };
      }),
    }));
  }

  /** Drop a track-level default. */
  clearTrackDefault(trackId: string, name: ParamName): void {
    if (this.disposed) return;
    this.bank.updateActivePattern((p) => ({
      ...p,
      tracks: p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        if (t.defaults[name] === undefined) return t;
        const { [name]: _dropped, ...rest } = t.defaults;
        return { ...t, defaults: rest };
      }),
    }));
  }

  setBpm(bpm: number): void {
    if (this.disposed) return;
    const clamped = Math.max(30, Math.min(300, Math.round(bpm)));
    this.bank.updateActivePattern((p) => ({ ...p, bpm: clamped }));
    // Note: stepIntervalTicks is recomputed on every wake-up, so
    // an in-flight pattern adopts the new BPM at the next
    // unscheduled step. No manual reset.
  }

  setLength(length: PatternLength): void {
    if (this.disposed) return;
    this.bank.updateActivePattern((p) => {
      if (p.length === length) return p;
      return {
        ...p,
        length,
        tracks: p.tracks.map((t) => ({
          ...t,
          steps: resizeSteps(t.steps, length),
        })),
      };
    });
  }

  // ── Transport ──────────────────────────────────────────────────────

  /** Start playback. Pattern starts at step 0, scheduled
   *  `INITIAL_LOOKAHEAD_TICKS` ahead of "now" so the first event
   *  has time to traverse the wire. No-op if already playing. */
  play(): void {
    if (this.disposed) return;
    if (this._transport.get().isPlaying) return;
    if (this.clock.tick0Ms === null) {
      // Clock hasn't started — nothing to anchor against. Caller
      // should disable the Play button until the clock resumes.
      console.warn('[sc:sequencer] play() ignored — clock not running');
      return;
    }

    const nowTick = ((Date.now() - this.clock.tick0Ms) * this.clock.tickRate) / 1000;
    resetForPlay(this.schedulerState, nowTick);
    this._transport.set({ isPlaying: true, currentStep: -1 });
    this.startWakeLoop();
  }

  stop(): void {
    if (this.disposed) return;
    if (!this._transport.get().isPlaying) return;
    this.stopWakeLoop();
    cancelPendingPlayheadTimers(this.schedulerState);
    this._transport.set(STOPPED_TRANSPORT);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopWakeLoop();
    cancelPendingPlayheadTimers(this.schedulerState);
    this._transport.set(STOPPED_TRANSPORT);
  }

  // ── private ────────────────────────────────────────────────────────

  private startWakeLoop(): void {
    if (this.wakeTimer !== null) return;
    // Pump once immediately so the first step lands as soon as
    // possible, then settle into the periodic cadence.
    this.pumpOnce();
    this.wakeTimer = window.setInterval(() => this.pumpOnce(), WAKE_INTERVAL_MS);
  }

  private stopWakeLoop(): void {
    if (this.wakeTimer === null) return;
    window.clearInterval(this.wakeTimer);
    this.wakeTimer = null;
  }

  private pumpOnce(): void {
    if (this.disposed) return;
    if (!this._transport.get().isPlaying) return;
    pump(
      this.bank.activePattern.get(),
      this.clock,
      this.dirtClient,
      this.schedulerState,
      {
        onStep: (stepIndex) => {
          if (this.disposed) return;
          this._transport.update((s) => ({ ...s, currentStep: stepIndex }));
        },
      },
    );
  }
}

/** Pad with empty inactive steps or truncate to match the new
 *  pattern length. Existing steps (active flag + per-cell overrides)
 *  are preserved when shrinking down to `length`; the discarded tail
 *  is gone. */
function resizeSteps(steps: Step[], length: PatternLength): Step[] {
  if (steps.length === length) return steps;
  if (steps.length > length) return steps.slice(0, length);
  const tail = Array.from(
    { length: length - steps.length },
    makeEmptyStep,
  );
  return steps.concat(tail);
}

/** Helper for `clearStepParam`: produce a new step value that
 *  drops the `params` field entirely if `rest` is empty, or
 *  keeps it otherwise. Centralises the "no params object means
 *  no overrides" invariant so `stepHasOverrides` stays cheap. */
function paramsObjectToStep(prev: Step, rest: ParamMap): Step {
  for (const key of PARAM_NAMES) {
    if (rest[key] !== undefined) {
      return { ...prev, params: rest };
    }
  }
  // All cleared → drop the params object entirely.
  return { active: prev.active };
}
