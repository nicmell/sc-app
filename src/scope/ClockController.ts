/**
 * Owns the global clock synth's lifecycle and the UI-facing tick stream.
 *
 * Pause/resume is **synth-level** (`/n_run nodeId 0|1` against the
 * clock synth itself), not group-level. This matters at startup:
 * `start({ startPaused: true })` bundles the synth's `/s_new` with
 * a paired `/n_run nodeId 0` so scsynth processes both atomically
 * before its next audio block — the clock synth never gets a chance
 * to fire even one `/tr` before being paused. The previous design
 * (start the synth, then group-pause) gave it a brief window to tick
 * a few times during the round-trip, which polluted the dashboard's
 * "fresh from connect" state with bogus startup ticks.
 *
 * **Group ordering invariant.** The clock synth is added with
 * `AddToHead`; every other synth that reads the clock bus (scopes,
 * recorders) MUST be added with `AddToTail` so scsynth processes
 * them AFTER the clock on every control block — otherwise they'd
 * read the previous block's bus value, introducing ~1 ms lag.
 *
 * `effectiveState` derives from `paused + tickFresh`: while paused
 * is `false` (i.e. the synth's runFlag is 1) but no tick has arrived
 * in `2 × tickIntervalMs`, we surface `paused` so the UI doesn't
 * lie about a silent server. Resolves back to `running` as soon as
 * a tick lands.
 */

import type {
  AudioEnvironment,
  ClockDerived,
  ClockParams,
} from '@/config/clockConfig';
import { CLOCK_TRIG_ID, deriveClock } from '@/config/clockConfig';
import {
  CLOCK_SYNTHDEF_NAME,
  compileClockSynthDef,
} from '@/synth/clockSynthDef';
import {
  AddToHead,
  OSC,
  nFree,
  nRunOne,
  sNew,
} from '@sc-app/server-commands';
import type { GroupController } from './GroupController';
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

interface ClockControllerOptions {
  client: WorkerClient;
  group: GroupController;
  registry: SynthDefRegistry;
  nodeIds: IdAllocator;
  busIds: IdAllocator;
  env: AudioEnvironment;
  params: ClockParams;
}

export interface ClockStartOptions {
  /** When true, the clock synth is /s_new'd and immediately paused
   *  in the same OSC bundle, so scsynth never processes an audio
   *  block with the synth running. Used at dashboard bring-up so
   *  the user sees a clean "paused, no ticks fired yet" state. */
  startPaused?: boolean;
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
  private watchdog: number | null = null;
  private started = false;
  /** True when the clock synth's runFlag is 0 (paused). Mirrors the
   *  state we last sent to scsynth via `/n_run`. Drives the
   *  `effectiveState` computation alongside the tick-freshness
   *  watchdog. */
  private paused = false;
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
   *  overriding a "running" state back to `paused`. */
  get effectiveState(): ReadonlyStore<ClockState> {
    return this.effectiveStateStore;
  }

  /** JS ms timestamp corresponding to tick 0, anchored on the first
   *  tick we see. Callers pair this with `derived.tickRate` (or
   *  `tickToTimetag`) to schedule OSC bundles at sample-accurate
   *  future tick boundaries. Null until the first tick lands. */
  get tick0Ms(): number | null {
    return this._tick0Ms;
  }

  /** First-time bring-up: load synthdef, create group, register the
   *  clock trigId, add the clock synth at head. Idempotent.
   *
   *  When `opts.startPaused` is true (the default for the dashboard
   *  flow), the synth is created paused via an atomic
   *  `/s_new + /n_run nodeId 0` bundle — see the file-level
   *  doc-comment for why. */
  async start(opts: ClockStartOptions = {}): Promise<void> {
    if (this.started) return;
    const startPaused = opts.startPaused ?? false;

    await this.registry.ensureLoaded(
      CLOCK_SYNTHDEF_NAME,
      compileClockSynthDef(this.derived.tickRate),
    );
    await this.group.ensureCreated();

    this.client.registerClock(CLOCK_TRIG_ID);
    this.offTick = this.client.onTick((tick) => this.handleTick(tick));
    this.startWatchdog();

    this.clockNodeId = this.nodeIds.next();
    this.lastSignalAt = performance.now();
    const sNewMsg = sNew(
      CLOCK_SYNTHDEF_NAME,
      this.clockNodeId,
      AddToHead,
      this.group.groupId,
      { clockBus: this.clockBus },
    );
    if (startPaused) {
      // Atomic create-then-pause. scsynth processes a bundle's
      // commands sequentially between audio blocks, so the synth
      // never ticks: by the time the next block runs, /n_run has
      // already cleared the runFlag.
      const bundle = new OSC.Bundle([
        sNewMsg,
        nRunOne(this.clockNodeId, 0),
      ]);
      this.paused = true;
      await this.client.sendAndSync(bundle);
    } else {
      this.paused = false;
      await this.client.sendAndSync(sNewMsg);
    }

    this.started = true;
    this.recompute();
  }

  /** Pause the clock synth (`/n_run nodeId 0`). The parent group
   *  stays running — only the clock's `Impulse.kr` and `Phasor.ar`
   *  freeze. With no `/tr` firing, the worker stops dispatching
   *  `/b_getn` so any scopes/recorders go quiet too. */
  async stop(): Promise<void> {
    if (!this.started || this.clockNodeId === null) return;
    if (this.paused) return;
    this.paused = true;
    this.recompute();
    await this.client.sendAndSync(nRunOne(this.clockNodeId, 0));
  }

  /** Resume the clock synth (`/n_run nodeId 1`). */
  async resume(): Promise<void> {
    if (!this.started || this.clockNodeId === null) return;
    if (!this.paused) return;
    // Reset the freshness clock so the warmup grace kicks in again —
    // the old `lastSignalAt` predates the pause and would otherwise
    // make the UI flicker `paused` for one watchdog period after
    // resume.
    this.lastSignalAt = performance.now();
    this.paused = false;
    this.recompute();
    await this.client.sendAndSync(nRunOne(this.clockNodeId, 1));
  }

  /** Free the clock synth and re-add it, returning tickIndex to 0.
   *  Group (and other children) untouched. Preserves the current
   *  paused-or-not state via the same atomic-bundle trick. */
  async reset(): Promise<void> {
    if (this.clockNodeId === null) return;
    await this.client.sendAndSync(nFree(this.clockNodeId));

    this.lastTickStore.set(null);
    this._tick0Ms = null;
    this.lastSignalAt = performance.now();
    this.clockNodeId = this.nodeIds.next();
    const sNewMsg = sNew(
      CLOCK_SYNTHDEF_NAME,
      this.clockNodeId,
      AddToHead,
      this.group.groupId,
      { clockBus: this.clockBus },
    );
    if (this.paused) {
      await this.client.sendAndSync(
        new OSC.Bundle([sNewMsg, nRunOne(this.clockNodeId, 0)]),
      );
    } else {
      await this.client.sendAndSync(sNewMsg);
    }
    this.recompute();
  }

  /** Full teardown — free the clock, unregister, stop the watchdog.
   *  The parent group is left alone; `GroupController.free` is the
   *  caller's job. */
  async dispose(): Promise<void> {
    this.stopWatchdog();
    this.offTick?.();
    this.offTick = null;
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
    this.paused = false;
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
      this._tick0Ms =
        Date.now() - (tick.tickIndex * 1000) / this.derived.tickRate;
    }
    // A fresh tick while we were showing 'paused'-due-to-silence
    // flips us back to 'running'. `paused` (real pause) stays
    // pinned by `recompute`.
    this.recompute();
  }

  private recompute(): void {
    let next: ClockState;
    if (!this.started) {
      next = 'stopped';
    } else if (this.paused) {
      next = 'paused';
    } else if (this.isTickFresh()) {
      next = 'running';
    } else {
      // Synth thinks it's running but no recent tick — surface as
      // paused so the UI doesn't lie.
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
      this.recompute();
    }, periodMs);
  }

  private stopWatchdog(): void {
    if (this.watchdog !== null) {
      window.clearInterval(this.watchdog);
      this.watchdog = null;
    }
  }
}
