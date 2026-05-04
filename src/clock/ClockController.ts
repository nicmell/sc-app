/**
 * Phase 30: passive observer of the shared clock.
 *
 * The clock synth lives in sclang (see
 * `scripts/sc-app-superdirt-startup.scd` — `\scAppClock` SynthDef
 * + `OSCdef(\scAppClockHello)`) at scsynth's root group, **outside**
 * any client's parent group. This controller no longer owns the
 * synth's lifecycle — it just attaches, fetches the running clock's
 * configuration via `/clock/hello`, and observes the `/clock/tick` stream
 * scsynth multicasts to every `/notify`'d session.
 *
 * Pause/resume is **local** to the parent group: clicking Pause in
 * the UI calls `group.pause()` (`/n_run groupId 0`), which freezes
 * THIS client's scopes, recorders, and tap synths. The shared clock
 * keeps ticking — other clients are unaffected. This is by design;
 * see plan.md Phase 30 for the rationale.
 *
 * `effectiveState` derives from group state + tick freshness. While
 * the controller is detached (no `/clock/tick` for > the watchdog window),
 * we surface `stopped` so the UI doesn't lie about a silent server.
 *
 * **Phase 33b: freshness detection lives in the worker.** Pre-33 a
 * main-thread `setInterval` re-evaluated freshness every
 * `tickInterval / 2` ms. Chromium throttling clamped that to
 * once-per-second/minute on backgrounded tabs while `clockTick`
 * postMessages from the worker piled up — the watchdog read a
 * stale `lastSignalAt` and falsely flipped the UI to 'paused'.
 * 33b moves the watchdog into `src/workers/clockWatchdog.ts`,
 * where ticks arrive without queueing and `setInterval` runs
 * unthrottled. The worker only posts `clockFreshness` events on
 * transitions; this controller consumes them as the truth.
 *
 * **Group ordering invariant.** Tap synths in the parent group must
 * be `/s_new`'d with `AddToTail` so scsynth processes them after
 * any producer they depend on. Historically the load-bearing case
 * was tap synths reading the clock's `clockBus` (~1.3 ms lag if
 * out of order); post-Phase-31 taps don't read clockBus, but the
 * invariant still applies to any future producer→consumer chain
 * inside the parent group.
 */

import type {
  AudioEnvironment,
  ClockDerived,
} from '@/config/clockConfig';
import { deriveClock } from '@/config/clockConfig';
import { type ClockInfo } from '@/clock/clockClient';
import { GroupController, type GroupState } from '@/server/GroupController';
import type { ReadonlyStore } from '@/util/reactiveStore';
import { createStore } from '@/util/reactiveStore';
import type { WorkerClient } from '@/server/WorkerClient';
import type { ClockTick } from '@/server/workerProtocol';

export type ClockState = 'stopped' | 'running' | 'paused';

interface ClockControllerOptions {
  client: WorkerClient;
  /** Used for `effectiveState` derivation only — the controller does
   *  not manipulate the group itself. */
  group: GroupController;
  /** Phase 39b: `ClockInfo` from cached SessionInfo metadata.
   *  Pre-39 the controller did its own `/clock/hello` round-trip
   *  in `attach()`; post-39 the bridge fetches once at boot via
   *  `/sc-app/bootstrap/hello` and surfaces it via `SessionInfo.clock`.
   *  No more per-session OSC round-trip. */
  info: ClockInfo;
}

export class ClockController {
  private readonly client: WorkerClient;
  private readonly group: GroupController;

  private readonly lastTickStore = createStore<ClockTick | null>(null);
  private readonly effectiveStateStore = createStore<ClockState>('stopped');

  private _info: ClockInfo | null = null;
  private _derived: ClockDerived | null = null;
  private offTick: (() => void) | null = null;
  private offGroupState: (() => void) | null = null;
  private offClockFreshness: (() => void) | null = null;
  private attached = false;
  /** Phase 33b: freshness state, populated by `clockFreshness`
   *  events from the worker watchdog. The worker posts an initial
   *  `true` on `startClockWatchdog`, then only on transitions. */
  private freshTickObserved = false;
  /** Main-thread `Date.now()` anchored at the first tick's arrival,
   *  minus the tick's own index-in-time. Used by `tickToTimetag` to
   *  convert server tick indices into NTP timetags. Null until the
   *  first observed tick. */
  private _tick0Ms: number | null = null;

  constructor(opts: ClockControllerOptions) {
    this.client = opts.client;
    this.group = opts.group;
    this._info = opts.info;
    this._derived = deriveClock(
      { sampleRate: opts.info.sampleRate },
      { chunkSize: opts.info.chunkSize },
    );
  }

  /** ClockInfo cached from SessionInfo at construction. Always
   *  populated (Phase 39b: no async fetch). */
  get info(): ClockInfo {
    if (this._info === null) {
      throw new Error('ClockController.info: invariant violated (info null after construction)');
    }
    return this._info;
  }

  get derived(): ClockDerived {
    if (this._derived === null) {
      throw new Error(
        'ClockController.derived: invariant violated (derived null after construction)',
      );
    }
    return this._derived;
  }

  /** Pre-Phase-30 callers (`RecordingManager`, `ScopeManager`)
   *  reach for `clock.env.sampleRate` as the WAV-header / scope-rate
   *  value. Synthesised from `info.sampleRate` here so those call
   *  sites stay unchanged. */
  get env(): AudioEnvironment {
    return { sampleRate: this.info.sampleRate };
  }

  /** Phase 36: audio bus index sclang allocated for the clock's
   *  sample-counting Phasor. Read by the OSC-fallback tap SynthDef
   *  via `In.ar(clockBus)` to derive a sample-aligned ring-buffer
   *  `writeIdx`. SHM mode doesn't use this. */
  get clockBus(): number {
    return this.info.clockBus;
  }

  /** Monotonic pulse count from the most recent observed tick, or
   *  null if no tick has arrived since `attach()`. */
  get lastTick(): ReadonlyStore<ClockTick | null> {
    return this.lastTickStore;
  }

  /** `running` / `paused` / `stopped`, with stale-tick detection
   *  overriding a "running" group back to `paused`. Becomes
   *  `'stopped'` when the controller is detached or sclang stops
   *  emitting `/clock/tick`s. */
  get effectiveState(): ReadonlyStore<ClockState> {
    return this.effectiveStateStore;
  }

  /** JS ms timestamp corresponding to tick 0, anchored on the first
   *  tick we observed. Pair with `derived.tickRate` (or
   *  `tickToTimetag`) to schedule OSC bundles at sample-accurate
   *  future tick boundaries. Null until the first tick lands. */
  get tick0Ms(): number | null {
    return this._tick0Ms;
  }

  /** Phase 39b: register the tick handler and start the
   *  freshness watchdog. ClockInfo is already populated from
   *  SessionInfo at construction; no per-session OSC round-trip.
   *  Idempotent. */
  attach(): void {
    if (this.attached) return;
    if (this._derived === null) {
      throw new Error(
        'ClockController.attach: derived not populated (constructor invariant violated)',
      );
    }

    this.offTick = this.client.onTick((tick) => this.handleTick(tick));
    this.offGroupState = this.group.state.subscribe((s) => this.recompute(s));
    // Phase 33b: subscribe BEFORE starting the worker watchdog so
    // we don't miss the initial `fresh: true` event the worker
    // posts on `startClockWatchdog`.
    this.offClockFreshness = this.client.onClockFreshness((fresh) =>
      this.handleFreshness(fresh),
    );
    this.client.startClockWatchdog(this._derived.tickIntervalMs);
    this.attached = true;
    this.recompute(this.group.state.get());
  }

  /** Tear down listeners and the watchdog. The shared clock keeps
   *  running on sclang's side — we just stop observing it.
   *  Idempotent. */
  detach(): void {
    if (this.attached) {
      this.client.stopClockWatchdog();
    }
    this.offTick?.();
    this.offTick = null;
    this.offGroupState?.();
    this.offGroupState = null;
    this.offClockFreshness?.();
    this.offClockFreshness = null;
    this.attached = false;
    this.freshTickObserved = false;
    this._tick0Ms = null;
    this.lastTickStore.set(null);
    this.effectiveStateStore.set('stopped');
  }

  // ── Internals ─────────────────────────────────────────────────────

  private handleTick(tick: ClockTick): void {
    this.lastTickStore.set(tick);
    // Anchor tick0 on the first observed tick. `Date.now()` is used
    // (not `performance.now()`) because OSC NTP timetags are aligned
    // to wall-clock epoch; `tickToTimetag(tick0Ms, N, tickRate)`
    // must return something scsynth's scheduler accepts as a JS
    // timestamp-ms.
    if (this._tick0Ms === null && this._derived !== null) {
      this._tick0Ms =
        Date.now() - (tick.tickIndex * 1000) / this._derived.tickRate;
    }
    // Freshness is updated by the worker's `clockFreshness` event,
    // not here — the worker calls `recordClockTick` on every
    // `/clock/tick` decode, which is the same event that drives
    // this listener. Avoiding a redundant `recompute` call here
    // means we react to freshness changes only when they actually
    // change, not every ~21 ms.
  }

  private handleFreshness(fresh: boolean): void {
    if (this.freshTickObserved === fresh) return;
    this.freshTickObserved = fresh;
    this.recompute(this.group.state.get());
  }

  private recompute(groupState: GroupState): void {
    let next: ClockState;
    if (!this.attached) {
      next = 'stopped';
    } else if (groupState === 'stopped') {
      next = 'stopped';
    } else if (groupState === 'paused') {
      next = 'paused';
    } else if (this.freshTickObserved) {
      next = 'running';
    } else {
      // Group says running but no recent tick — surface as paused.
      // (Means sclang stopped emitting; could be a sclang restart
      // mid-session. The status-pill turning amber is the user's
      // signal to investigate.)
      next = 'paused';
    }
    this.effectiveStateStore.set(next);
  }
}
