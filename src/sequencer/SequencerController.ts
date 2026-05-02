/**
 * Step-sequencer controller (Phase 27).
 *
 * Owns the pattern state + transport + JS wake-up loop. Drives
 * SuperDirt via the existing `DirtClient`. Anchors all timing to
 * `ClockController.tick0Ms` + `tickRate` so playback stays
 * sample-accurate against the audio engine's clock; the JS
 * scheduler just keeps OSC bundles on the wire ahead of their
 * fire time.
 *
 * Lifecycle:
 * - Created in `setupDashboard`, given the live `clock` and
 *   `dirtClient`.
 * - `dispose()` stops playback + cancels pending playhead
 *   timeouts; safe to call multiple times.
 * - chunkSize re-init (Q8 = ii) tears down the controller and
 *   re-creates it with a fresh, empty pattern. If you want
 *   pattern survival across re-init, lift the `Pattern` to
 *   `DashboardResources` outside the controller; it's a small
 *   plumbing change.
 *
 * Pattern mutations are immutable: every method that touches the
 * pattern produces a new object reference, so `Object.is`-based
 * change detection (the reactive store) fires correctly.
 */

import { createStore, type ReadonlyStore } from '@/util/reactiveStore';

import {
  cancelPendingPlayheadTimers,
  makeInitialSchedulerState,
  pump,
  resetForPlay,
  type SchedulerState,
} from './scheduler';
import {
  makeEmptyPattern,
  makeEmptyTrack,
  type ClockLike,
  type DirtClientLike,
  type Pattern,
  type PatternLength,
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
  /** Override the initial pattern. Defaults to an empty 16-step
   *  pattern with no tracks. */
  initialPattern?: Pattern;
}

export class SequencerController {
  private readonly clock: ClockLike;
  private readonly dirtClient: DirtClientLike;

  private readonly _pattern;
  private readonly _transport;
  private readonly schedulerState: SchedulerState;
  private wakeTimer: number | null = null;
  private disposed = false;

  constructor(opts: SequencerControllerOptions) {
    this.clock = opts.clock;
    this.dirtClient = opts.dirtClient;
    this._pattern = createStore<Pattern>(opts.initialPattern ?? makeEmptyPattern());
    this._transport = createStore<TransportState>(STOPPED_TRANSPORT);
    this.schedulerState = makeInitialSchedulerState();
  }

  readonly pattern: ReadonlyStore<Pattern> = {
    get: () => this._pattern.get(),
    subscribe: (cb) => this._pattern.subscribe(cb),
  };

  readonly transport: ReadonlyStore<TransportState> = {
    get: () => this._transport.get(),
    subscribe: (cb) => this._transport.subscribe(cb),
  };

  // ── Pattern mutations ──────────────────────────────────────────────

  addTrack(sample = ''): void {
    if (this.disposed) return;
    this._pattern.update((p) => ({
      ...p,
      tracks: [...p.tracks, makeEmptyTrack(p.length, sample)],
    }));
  }

  removeTrack(trackId: string): void {
    if (this.disposed) return;
    this._pattern.update((p) => ({
      ...p,
      tracks: p.tracks.filter((t) => t.id !== trackId),
    }));
  }

  setTrackSample(trackId: string, sample: string): void {
    if (this.disposed) return;
    this._pattern.update((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, sample } : t)),
    }));
  }

  setTrackGain(trackId: string, gain: number): void {
    if (this.disposed) return;
    const clamped = Math.max(0, Math.min(2, gain));
    this._pattern.update((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === trackId ? { ...t, gain: clamped } : t)),
    }));
  }

  toggleStep(trackId: string, stepIndex: number): void {
    if (this.disposed) return;
    this._pattern.update((p) => ({
      ...p,
      tracks: p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        if (stepIndex < 0 || stepIndex >= t.steps.length) return t;
        const nextSteps = t.steps.slice();
        nextSteps[stepIndex] = !nextSteps[stepIndex];
        return { ...t, steps: nextSteps };
      }),
    }));
  }

  setBpm(bpm: number): void {
    if (this.disposed) return;
    const clamped = Math.max(30, Math.min(300, Math.round(bpm)));
    this._pattern.update((p) => ({ ...p, bpm: clamped }));
    // Note: stepIntervalTicks is recomputed on every wake-up, so
    // an in-flight pattern adopts the new BPM at the next
    // unscheduled step. No manual reset.
  }

  setLength(length: PatternLength): void {
    if (this.disposed) return;
    this._pattern.update((p) => {
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
      this._pattern.get(),
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

/** Pad with `false` or truncate to match the new pattern length. */
function resizeSteps(steps: boolean[], length: PatternLength): boolean[] {
  if (steps.length === length) return steps;
  if (steps.length > length) return steps.slice(0, length);
  return steps.concat(new Array<boolean>(length - steps.length).fill(false));
}
