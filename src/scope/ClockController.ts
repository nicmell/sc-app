/**
 * Owns the global clock synth's lifecycle and the UI-facing tick stream.
 *
 * Composition, not inheritance: a single `GroupController` is shared by
 * every controller that needs the parent group (Phase 7+ will add
 * scope and recorder controllers). `stop()` / `resume()` delegate to
 * the group so everything under the parent freezes together — the
 * "global pause" semantic called for in the plan.
 *
 * `effectiveState` derives from `groupState + tickFresh`: while the
 * group state says `running` but no tick has arrived in
 * `2 × tickIntervalMs`, we surface `paused` so the UI doesn't lie
 * about a silent server. Resolves back to `running` as soon as a
 * tick lands.
 *
 * **Group ordering invariant.** The clock synth is added with
 * `AddToHead`; every other synth that reads the clock bus (scopes,
 * recorders, the dev probe) MUST be added with `AddToTail` so scsynth
 * processes them AFTER the clock on every control block — otherwise
 * they'd read the previous block's bus value, introducing ~1 ms lag.
 */

import type {
  AudioEnvironment,
  ClockDerived,
  ClockParams,
} from '@/config/clockConfig';
import {
  CLOCK_TRIG_ID,
  PHASE_PROBE_TRIG_ID,
  deriveClock,
} from '@/config/clockConfig';
import {
  CLOCK_SYNTHDEF_NAME,
  compileClockSynthDef,
} from '@/synth/clockSynthDef';
import {
  PHASE_PROBE_SYNTHDEF_NAME,
  compilePhaseProbeSynthDef,
} from '@/synth/phaseProbeSynthDef';
import { AddToHead, AddToTail, nFree, sNew } from '@sc-app/server-commands';
import { GroupController, type GroupState } from './GroupController';
import type { IdAllocator } from './IdAllocator';
import type { ReadonlyStore } from './reactiveStore';
import { createStore } from './reactiveStore';
import type { SynthDefRegistry } from './SynthDefRegistry';
import type { WorkerClient } from './WorkerClient';
import type { ClockTick } from './workerProtocol';

export type ClockState = 'stopped' | 'running' | 'paused';

/** Grace window applied to the freshness check before any tick has
 *  been seen — covers scsynth scheduling latency right after `start`
 *  / `resume` / `reset`. Comfortably larger than the 2 × tickInterval
 *  watchdog that takes over once ticks are flowing. */
const TICK_STARTUP_GRACE_MS = 500;

/** Default duration for `ClockController.probePhase`. Two seconds
 *  × replyRate=10 gives ~20 phase samples, enough to see the saw
 *  sweep 0 → wrap several times. */
const DEFAULT_PROBE_MS = 2000;

/** kr reply-rate of the phase probe synth. Ten samples per second
 *  keeps `/tr` traffic light. */
const PROBE_REPLY_RATE = 10;

/** Result of a `probePhase()` run — simple aggregate stats over the
 *  decoded phase values delivered by the probe synth. */
export interface PhaseProbeResult {
  /** Number of `/tr` replies received. */
  count: number;
  /** Smallest phase value observed (or 0 if `count === 0`). */
  min: number;
  /** Largest phase value observed (or 0 if `count === 0`). */
  max: number;
  /** First ~10 values in receive order, for eyeballing the saw. */
  first: number[];
}

interface ClockControllerOptions {
  client: WorkerClient;
  group: GroupController;
  registry: SynthDefRegistry;
  nodeIds: IdAllocator;
  busIds: IdAllocator;
  env: AudioEnvironment;
  params: ClockParams;
}

export class ClockController {
  readonly env: AudioEnvironment;
  readonly params: ClockParams;
  readonly derived: ClockDerived;
  /** Audio bus index on which the clock publishes its shared sample
   *  phase. Scope / recorder synths read this via `In.ar(clockBus)`. */
  readonly clockBus: number;

  private readonly client: WorkerClient;
  private readonly group: GroupController;
  private readonly registry: SynthDefRegistry;
  private readonly nodeIds: IdAllocator;

  private readonly lastTickStore = createStore<ClockTick | null>(null);
  private readonly effectiveStateStore = createStore<ClockState>('stopped');

  private clockNodeId: number | null = null;
  private offTick: (() => void) | null = null;
  private offGroupState: (() => void) | null = null;
  private watchdog: number | null = null;
  private started = false;
  /** Most recent "we expect ticks to be flowing" moment — the latest
   *  of `start` / `resume` / `reset` or any incoming tick. Null while
   *  the controller is stopped. */
  private lastSignalAt: number | null = null;
  /** Main-thread `Date.now()` anchored at the first tick's arrival,
   *  minus the tick's own index-in-time. Used by `tickToTimetag` to
   *  convert server tick indices into NTP timetags for scheduled
   *  OSC bundles. Null until the first tick arrives. */
  private _tick0Ms: number | null = null;

  constructor(opts: ClockControllerOptions) {
    this.client = opts.client;
    this.group = opts.group;
    this.registry = opts.registry;
    this.nodeIds = opts.nodeIds;
    this.env = opts.env;
    this.params = opts.params;
    this.derived = deriveClock(opts.env, opts.params);
    this.clockBus = opts.busIds.next();
  }

  /** Monotonic pulse count from the most recent tick, or null if no
   *  tick has arrived since the last `reset()`. */
  get lastTick(): ReadonlyStore<ClockTick | null> {
    return this.lastTickStore;
  }

  /** `running` / `paused` / `stopped`, with stale-tick detection
   *  overriding a "running" group back to `paused`. */
  get effectiveState(): ReadonlyStore<ClockState> {
    return this.effectiveStateStore;
  }

  /** JS ms timestamp corresponding to tick 0, anchored on the first
   *  tick we see. Callers pair this with `params.tickRate` (or
   *  `tickToTimetag`) to schedule OSC bundles at sample-accurate
   *  future tick boundaries. Null until the first tick lands. */
  get tick0Ms(): number | null {
    return this._tick0Ms;
  }

  /** First-time bring-up: load synthdef, create group, register the
   *  clock trigId, add the clock synth at head. Idempotent. */
  async start(): Promise<void> {
    if (this.started) return;

    await this.registry.ensureLoaded(
      CLOCK_SYNTHDEF_NAME,
      compileClockSynthDef(this.params),
    );
    await this.group.ensureCreated();

    this.client.registerClock(CLOCK_TRIG_ID);
    this.offTick = this.client.onTick((tick) => this.handleTick(tick));
    this.offGroupState = this.group.state.subscribe((s) => this.recompute(s));
    this.startWatchdog();

    this.clockNodeId = this.nodeIds.next();
    this.lastSignalAt = performance.now();
    await this.client.sendAndSync(
      sNew(
        CLOCK_SYNTHDEF_NAME,
        this.clockNodeId,
        AddToHead,
        this.group.groupId,
        { clockBus: this.clockBus },
      ),
    );

    this.started = true;
    this.recompute(this.group.state.get());
  }

  /** Global pause — freezes the entire parent group, not just the clock. */
  async stop(): Promise<void> {
    await this.group.pause();
  }

  async resume(): Promise<void> {
    // Reset the freshness clock so the warmup grace kicks in again —
    // the old `lastTick` predates the pause and would otherwise make
    // the UI flicker `paused` for one watchdog period after resume.
    this.lastSignalAt = performance.now();
    await this.group.resume();
    this.recompute(this.group.state.get());
  }

  /** Free the clock synth and re-add it, returning tickIndex to 0.
   *  Group (and other children) untouched. */
  async reset(): Promise<void> {
    if (this.clockNodeId === null) return;
    await this.client.sendAndSync(nFree(this.clockNodeId));

    this.lastTickStore.set(null);
    this._tick0Ms = null;
    this.lastSignalAt = performance.now();
    this.clockNodeId = this.nodeIds.next();
    await this.client.sendAndSync(
      sNew(
        CLOCK_SYNTHDEF_NAME,
        this.clockNodeId,
        AddToHead,
        this.group.groupId,
        { clockBus: this.clockBus },
      ),
    );
    this.recompute(this.group.state.get());
  }

  /** Dev-only diagnostic. Temporarily add a `phaseProbe` synth at the
   *  tail of the parent group, collect its `/tr` replies for
   *  `durationMs`, then free it. Returns aggregate stats over the
   *  phase values observed — use it to confirm the clock is actually
   *  publishing a sawtooth on `clockBus`.
   *
   *  The probe uses `PHASE_PROBE_TRIG_ID` which differs from the
   *  clock's `CLOCK_TRIG_ID`, so its replies flow through
   *  `WorkerClient.onReply` (not the suppressed clock-tick channel). */
  async probePhase(durationMs = DEFAULT_PROBE_MS): Promise<PhaseProbeResult> {
    if (!this.started || this.clockNodeId === null) {
      throw new Error('probePhase: clock not started');
    }

    await this.registry.ensureLoaded(
      PHASE_PROBE_SYNTHDEF_NAME,
      compilePhaseProbeSynthDef(),
    );

    const values: number[] = [];
    const offReply = this.client.onReply((reply) => {
      if (
        reply.address === '/tr' &&
        reply.args[1] === PHASE_PROBE_TRIG_ID
      ) {
        values.push(reply.args[2] as number);
      }
    });

    const probeNodeId = this.nodeIds.next();
    try {
      await this.client.sendAndSync(
        sNew(
          PHASE_PROBE_SYNTHDEF_NAME,
          probeNodeId,
          AddToTail,
          this.group.groupId,
          { clockBus: this.clockBus, replyRate: PROBE_REPLY_RATE },
        ),
      );
      await new Promise((r) => setTimeout(r, durationMs));
    } finally {
      offReply();
      try {
        await this.client.sendAndSync(nFree(probeNodeId));
      } catch (err) {
        console.warn('[sc:clock] probe nFree failed', err);
      }
    }

    return {
      count: values.length,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
      first: values.slice(0, 10),
    };
  }

  /** Full teardown — free the clock, unregister, stop the watchdog.
   *  The parent group is left alone; `GroupController.free` is the
   *  caller's job. */
  async dispose(): Promise<void> {
    this.stopWatchdog();
    this.offTick?.();
    this.offTick = null;
    this.offGroupState?.();
    this.offGroupState = null;
    this.client.unregisterClock();

    if (this.clockNodeId !== null) {
      try {
        await this.client.sendAndSync(nFree(this.clockNodeId));
      } catch {
        // Best-effort — the server may already be gone.
      }
      this.clockNodeId = null;
    }
    this.started = false;
    this.lastSignalAt = null;
    this._tick0Ms = null;
    this.effectiveStateStore.set('stopped');
  }

  // ── Internals ─────────────────────────────────────────────────────

  private handleTick(tick: ClockTick): void {
    this.lastTickStore.set(tick);
    // Stamp freshness on the MAIN-thread clock, not the worker's —
    // `tick.receivedAt` is the worker's `performance.now()`, and a
    // worker's `performance.timeOrigin` is later than the window's,
    // so subtracting them gives a constant origin-skew (easily
    // 100s of ms) that would pin `isTickFresh` to false forever.
    const nowMs = performance.now();
    this.lastSignalAt = nowMs;
    // Anchor tick0 on the first tick we see. `Date.now()` is used
    // (not `performance.now()`) because OSC NTP timetags are aligned
    // to wall-clock epoch; `tickToTimetag(tick0Ms, N, tickRate)`
    // must return something scsynth's scheduler accepts as a JS
    // timestamp-ms.
    if (this._tick0Ms === null) {
      this._tick0Ms = Date.now() - (tick.tickIndex * 1000) / this.params.tickRate;
    }
    // A fresh tick while we were showing 'paused'-due-to-silence flips
    // us back to 'running'. Group-state-driven `paused` (real pause)
    // stays pinned by `recompute`.
    this.recompute(this.group.state.get());
  }

  private recompute(groupState: GroupState): void {
    let next: ClockState;
    if (groupState === 'stopped') {
      next = 'stopped';
    } else if (groupState === 'paused') {
      next = 'paused';
    } else if (this.isTickFresh()) {
      next = 'running';
    } else {
      // Group says running but no recent tick — surface as paused.
      next = 'paused';
    }
    this.effectiveStateStore.set(next);
  }

  private isTickFresh(): boolean {
    if (this.lastSignalAt === null) return false;
    const ageMs = performance.now() - this.lastSignalAt;
    // Before the first tick ever arrives, grant a startup grace so
    // the UI doesn't immediately claim 'paused' during scsynth's
    // scheduling latency window. Once a tick has been seen, the
    // normal 2 × tickIntervalMs watchdog takes over.
    const allowance = this.lastTickStore.get()
      ? this.derived.tickIntervalMs * 2
      : TICK_STARTUP_GRACE_MS;
    return ageMs < allowance;
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    const periodMs = Math.max(20, Math.floor(this.derived.tickIntervalMs / 2));
    this.watchdog = window.setInterval(() => {
      this.recompute(this.group.state.get());
    }, periodMs);
  }

  private stopWatchdog(): void {
    if (this.watchdog !== null) {
      window.clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }
}
