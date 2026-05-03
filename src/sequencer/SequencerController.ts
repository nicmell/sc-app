/**
 * Step-sequencer controller (Phase 27 + Phase 32).
 *
 * Owns transport state and pattern mutation API; delegates the
 * timing-critical pump loop to the OSC worker via
 * `WorkerClient.startSequencer`. The worker holds the full bank
 * + clock snapshot, runs an unthrottled `setInterval`, encodes
 * `/dirt/play` bundles with sample-accurate timetags, and ships
 * them via the WebSocket transport.
 *
 * Why the worker. Chromium clamps main-thread `setTimeout` /
 * `setInterval` to ~1 Hz on backgrounded tabs; web workers are
 * not throttled. Pre-32 the pump ran on main and produced audio
 * gaps every time the user switched to a different tab. Phase 32
 * moves the pump behind a `postMessage` boundary into the
 * existing OSC worker context.
 *
 * What stays on main: the public API (`play()`, `stop()`,
 * pattern mutations, reactive stores), bank-snapshot dispatch,
 * group-pause forwarding, chain-mode UI display state. What
 * moves to worker: the wake loop, `tickToTimetag` math, OSC
 * bundle encoding, `transport.send`, per-step playhead
 * timeouts.
 *
 * Pattern mutations are immutable: every method that touches the
 * pattern produces a new object reference, so the bank's
 * reactive store fires correctly. The store subscription this
 * controller registers in `play()` posts the new bank snapshot
 * to the worker, so an in-flight pattern adopts edits within one
 * pump cycle (~25 ms).
 *
 * Lifecycle:
 * - Created in `setupDashboard`, given the live `client`,
 *   `clock`, `bank`, and `group.state` store.
 * - `dispose()` stops playback (= posts `sequencerStop` to
 *   worker) and detaches the bank/group subscriptions; safe to
 *   call multiple times. The bank itself is long-lived across
 *   re-init — disposed at the AppShell level.
 *
 * Chain-mode auto-advance (`bank.chain` cycles → next slot at
 * cycle boundary) is temporarily inert in 32b: the
 * `nextStepIndex` counter that drove it lives in the worker
 * now, and stepFired callback wiring lands in 32c. The
 * `chainPlaybackIndex` reactive store still reflects the entry
 * the user manually selected via Play.
 */

import type { GroupState } from '@/server/GroupController';
import type { WorkerClient } from '@/server/WorkerClient';
import type {
  SequencerBankSnapshot,
  SequencerClockSnapshot,
} from '@/server/workerProtocol';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';

import type { PatternBank } from './PatternBank';
import {
  makeEmptyStep,
  makeEmptyTrack,
  PARAM_NAMES,
  type ClockLike,
  type ParamMap,
  type ParamName,
  type Pattern,
  type PatternLength,
  type Step,
  type TransportState,
} from './types';

const STOPPED_TRANSPORT: TransportState = {
  isPlaying: false,
  currentStep: -1,
};

export interface SequencerControllerOptions {
  /** Worker proxy. The controller delegates pump scheduling +
   *  OSC emission to the worker via this client. */
  client: WorkerClient;
  /** Read-only clock surface — the controller snapshots this
   *  into a `SequencerClockSnapshot` at start time and on clock
   *  changes. */
  clock: ClockLike;
  /** Source of truth for pattern state. Subscriptions to
   *  `slots` / `activeIndex` / `chain` keep the worker's
   *  snapshot fresh. */
  bank: PatternBank;
  /** Phase 30: parent-group pause flag. The worker pump skips
   *  `/dirt/play` emission while paused (shared clock keeps
   *  ticking; pause is local to this client). The controller
   *  subscribes and forwards changes to the worker. */
  groupState: ReadonlyStore<GroupState>;
}

export class SequencerController {
  private readonly client: WorkerClient;
  private readonly clock: ClockLike;
  private readonly bank: PatternBank;
  private readonly groupState: ReadonlyStore<GroupState>;

  private readonly _transport;
  /** UI-facing index of the chain entry currently playing
   *  (Phase 27d). `null` when chain mode is off, the chain is
   *  empty, or playback is stopped. The bank-selector pane
   *  reads this to highlight the playing entry. */
  private readonly _chainPlaybackIndex;

  /** Active subscriptions while playing — set up in `play()`,
   *  torn down in `stop()` / `dispose()`. */
  private offSlots: (() => void) | null = null;
  private offIndex: (() => void) | null = null;
  private offChain: (() => void) | null = null;
  private offGroupState: (() => void) | null = null;

  private disposed = false;

  constructor(opts: SequencerControllerOptions) {
    this.client = opts.client;
    this.clock = opts.clock;
    this.bank = opts.bank;
    this.groupState = opts.groupState;
    this._transport = createStore<TransportState>(STOPPED_TRANSPORT);
    this._chainPlaybackIndex = createStore<number | null>(null);
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

  readonly chainPlaybackIndex: ReadonlyStore<number | null> = {
    get: () => this._chainPlaybackIndex.get(),
    subscribe: (cb) => this._chainPlaybackIndex.subscribe(cb),
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
    // The worker's `stepIntervalTicks` reads pattern.bpm fresh
    // every pump, so an in-flight pattern adopts the new BPM
    // at the next unscheduled step. No manual reset.
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

  /** Start playback. Worker pump anchors the first step
   *  `INITIAL_LOOKAHEAD_TICKS` ahead of "now" so the bundle has
   *  time to traverse the wire. No-op if already playing.
   *
   *  Phase 27d: if `bank.chain.enabled` and the chain has at
   *  least one entry, we engage chain mode — selecting
   *  `chain[0]`'s slot in the bank. (Phase 32b: auto-advance
   *  through chain entries is temporarily inert until 32c
   *  wires `stepFired` into a step counter on main.) */
  play(): void {
    if (this.disposed) return;
    if (this._transport.get().isPlaying) return;
    if (this.clock.tick0Ms === null) {
      // Clock hasn't started — nothing to anchor against. Caller
      // should disable the Play button until the clock resumes.
      console.warn('[sc:sequencer] play() ignored — clock not running');
      return;
    }

    // If chain mode is engaged at play time, snap activeIndex to
    // the first chain entry. (Auto-advance through chain entries
    // is gated on Phase 32c's stepFired wiring.)
    const chain = this.bank.chain.get();
    if (chain.enabled && chain.steps.length > 0) {
      this._chainPlaybackIndex.set(0);
      this.bank.selectIndex(chain.steps[0].slotIndex);
    } else {
      this._chainPlaybackIndex.set(null);
    }

    this._transport.set({ isPlaying: true, currentStep: -1 });

    this.client.startSequencer(
      this.snapshotBank(),
      this.snapshotClock(),
      this.groupState.get() === 'paused',
    );

    // Subscribe AFTER startSequencer so the initial snapshot is
    // the one that wins; subsequent fires dispatch updates.
    this.offSlots = this.bank.slots.subscribe(() => this.postBankSnapshot());
    this.offIndex = this.bank.activeIndex.subscribe(() =>
      this.postBankSnapshot(),
    );
    this.offChain = this.bank.chain.subscribe(() => this.postBankSnapshot());
    this.offGroupState = this.groupState.subscribe((s) => {
      this.client.setSequencerPaused(s === 'paused');
    });
  }

  stop(): void {
    if (this.disposed) return;
    if (!this._transport.get().isPlaying) return;
    this.client.stopSequencer();
    this.unsubscribeFromBankAndGroup();
    this._chainPlaybackIndex.set(null);
    this._transport.set(STOPPED_TRANSPORT);
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this._transport.get().isPlaying) {
      this.client.stopSequencer();
    }
    this.unsubscribeFromBankAndGroup();
    this._transport.set(STOPPED_TRANSPORT);
  }

  // ── private ────────────────────────────────────────────────────────

  private snapshotBank(): SequencerBankSnapshot {
    return {
      slots: this.bank.slots.get(),
      activeIndex: this.bank.activeIndex.get(),
      chain: this.bank.chain.get(),
    };
  }

  private snapshotClock(): SequencerClockSnapshot {
    return {
      tick0Ms: this.clock.tick0Ms,
      tickRate: this.clock.tickRate,
      chunkSize: this.clock.chunkSize,
      sampleRate: this.clock.sampleRate,
    };
  }

  private postBankSnapshot(): void {
    if (this.disposed) return;
    if (!this._transport.get().isPlaying) return;
    this.client.updateSequencerBank(this.snapshotBank());
  }

  private unsubscribeFromBankAndGroup(): void {
    this.offSlots?.();
    this.offSlots = null;
    this.offIndex?.();
    this.offIndex = null;
    this.offChain?.();
    this.offChain = null;
    this.offGroupState?.();
    this.offGroupState = null;
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
