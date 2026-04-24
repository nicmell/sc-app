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
import { AddToHead, nFreeIds, sNewEasy } from './cmd';
import { GroupController, type GroupState } from './GroupController';
import type { IdAllocator } from './IdAllocator';
import type { ReadonlyStore } from './reactiveStore';
import { createStore } from './reactiveStore';
import type { SynthDefRegistry } from './SynthDefRegistry';
import type { WorkerClient } from './WorkerClient';
import type { ClockTick } from './workerProtocol';

export type ClockState = 'stopped' | 'running' | 'paused';

interface ClockControllerOptions {
  client: WorkerClient;
  group: GroupController;
  registry: SynthDefRegistry;
  nodeIds: IdAllocator;
  env: AudioEnvironment;
  params: ClockParams;
}

export class ClockController {
  readonly env: AudioEnvironment;
  readonly params: ClockParams;
  readonly derived: ClockDerived;

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

  constructor(opts: ClockControllerOptions) {
    this.client = opts.client;
    this.group = opts.group;
    this.registry = opts.registry;
    this.nodeIds = opts.nodeIds;
    this.env = opts.env;
    this.params = opts.params;
    this.derived = deriveClock(opts.env, opts.params);
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
    await this.client.sendAndSync(
      sNewEasy(CLOCK_SYNTHDEF_NAME, this.clockNodeId, AddToHead, this.group.groupId),
    );

    this.started = true;
    this.recompute(this.group.state.get());
  }

  /** Global pause — freezes the entire parent group, not just the clock. */
  async stop(): Promise<void> {
    await this.group.pause();
  }

  async resume(): Promise<void> {
    await this.group.resume();
  }

  /** Free the clock synth and re-add it, returning tickIndex to 0.
   *  Group (and other children) untouched. */
  async reset(): Promise<void> {
    if (this.clockNodeId === null) return;
    await this.client.sendAndSync(nFreeIds(this.clockNodeId));

    this.lastTickStore.set(null);
    this.clockNodeId = this.nodeIds.next();
    await this.client.sendAndSync(
      sNewEasy(CLOCK_SYNTHDEF_NAME, this.clockNodeId, AddToHead, this.group.groupId),
    );
    this.recompute(this.group.state.get());
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
        await this.client.sendAndSync(nFreeIds(this.clockNodeId));
      } catch {
        // Best-effort — the server may already be gone.
      }
      this.clockNodeId = null;
    }
    this.started = false;
    this.effectiveStateStore.set('stopped');
  }

  // ── Internals ─────────────────────────────────────────────────────

  private handleTick(tick: ClockTick): void {
    this.lastTickStore.set(tick);
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
    const tick = this.lastTickStore.get();
    if (!tick) return false;
    return performance.now() - tick.receivedAt < this.derived.tickIntervalMs * 2;
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
