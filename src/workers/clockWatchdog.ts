/**
 * Worker-side clock-freshness watchdog (Phase 33b).
 *
 * Pre-33 the freshness check ran on a main-thread `setInterval`
 * inside `ClockController`. Chromium throttles backgrounded-tab
 * timers to ~1 Hz (and dropping to once-per-minute under intensive
 * throttling), so the watchdog would fire late and read a stale
 * `lastSignalAt` (since `clockTick` postMessages from the worker
 * also queue up under throttling). Net effect: brief "amber clock"
 * flicker on tab refocus while main caught up to queued ticks.
 *
 * 33b moves the watchdog into the worker, where the ticks
 * actually arrive (no postMessage queue) and `setInterval` runs
 * unthrottled. The worker tracks `lastTickAt`, runs an interval
 * timer to compare it against `tickIntervalMs × 2`, and posts a
 * `clockFreshness` event to main only on transitions (fresh ↔
 * stale). Main consumes those events as the new source of truth
 * for the freshness component of `effectiveState`.
 *
 * Lifecycle, mirroring the main-thread version it replaces:
 * - `startClockWatchdog(tickIntervalMs)` — called by
 *   `ClockController.attach` once `/clock/info` resolves. Anchors
 *   `lastTickAt = Date.now()` (a "synthetic tick" so the
 *   500 ms startup grace works the same as before) and starts the
 *   check timer. Posts an initial `fresh: true` event.
 * - `recordClockTick()` — called from `oscWorker.ts` whenever a
 *   `/clock/tick` is decoded, before the existing `clockTick`
 *   postMessage. Updates `lastTickAt`; emits `fresh: true` if we
 *   were stale.
 * - `stopClockWatchdog()` — called by `ClockController.detach`.
 * - `disconnectClockWatchdog()` — called from `oscWorker.ts`'s
 *   disconnect path so worker state doesn't survive a WS close.
 */

import type { WorkerToMain } from '../server/workerProtocol';

/** Pre-first-tick allowance. Mirrors `TICK_STARTUP_GRACE_MS` from
 *  the deleted main-thread version: covers scsynth's scheduling
 *  latency between attach and the first `/clock/tick`. After the
 *  first tick lands the regular `tickIntervalMs × 2` allowance
 *  takes over. */
const STARTUP_GRACE_MS = 500;

interface State {
  /** `Date.now()` at the most recent tick (or the synthetic
   *  anchor placed by `startClockWatchdog`). We use wall-clock
   *  `Date.now` rather than monotonic `performance.now` because
   *  vitest's fake timers advance `Date.now` deterministically
   *  but leave `performance.now` running on real wall-clock time.
   *  The freshness window is short (~tickInterval × 2 ≈ 40 ms at
   *  default config) so any NTP-adjustment drift between
   *  measurements is irrelevant in practice. */
  lastTickAt: number | null;
  /** Whether a real `/clock/tick` has been observed since
   *  `startClockWatchdog`. Drives the allowance switch from
   *  startup grace to the regular watchdog window. */
  firstTickSeen: boolean;
  /** Cached from `startClockWatchdog`. Null when the watchdog
   *  isn't active. */
  tickIntervalMs: number | null;
  /** setInterval handle, null when stopped. */
  watchdogTimer: ReturnType<typeof setInterval> | null;
  /** Last `fresh` value we sent to main. We only post on
   *  transitions, so a steady stream of ticks doesn't flood the
   *  message channel. Null = "no event sent yet". */
  lastSentFresh: boolean | null;
}

const state: State = {
  lastTickAt: null,
  firstTickSeen: false,
  tickIntervalMs: null,
  watchdogTimer: null,
  lastSentFresh: null,
};

function postToMain(msg: WorkerToMain): void {
  (
    self as unknown as { postMessage: (msg: WorkerToMain) => void }
  ).postMessage(msg);
}

function emitFreshness(fresh: boolean): void {
  if (fresh === state.lastSentFresh) return;
  state.lastSentFresh = fresh;
  postToMain({ type: 'clockFreshness', fresh });
}

export function startClockWatchdog(tickIntervalMs: number): void {
  stopClockWatchdog();
  state.tickIntervalMs = tickIntervalMs;
  // Anchor `lastTickAt` at the start so the startup grace begins
  // ticking from now, not from null. Mirrors the
  // `lastSignalAt = Date.now()` line in the main-thread
  // ClockController.attach we replaced.
  state.lastTickAt = Date.now();
  state.firstTickSeen = false;
  state.lastSentFresh = null;
  // Check at half the tick interval — fast enough to catch a
  // genuine sclang outage within ~one tickInterval × 2 of
  // cessation, slow enough not to burn worker CPU. Bounded floor
  // of 20 ms so very small chunkSizes don't pin a tight loop.
  const checkInterval = Math.max(20, Math.floor(tickIntervalMs / 2));
  state.watchdogTimer = setInterval(check, checkInterval);
  // Initial state: fresh. The startup grace makes this true even
  // though no real tick has landed; the first real tick (or the
  // grace expiry without one) will drive the next transition.
  emitFreshness(true);
}

export function stopClockWatchdog(): void {
  if (state.watchdogTimer !== null) {
    clearInterval(state.watchdogTimer);
    state.watchdogTimer = null;
  }
  state.lastTickAt = null;
  state.firstTickSeen = false;
  state.tickIntervalMs = null;
  state.lastSentFresh = null;
}

export function recordClockTick(): void {
  // Always update `lastTickAt` even if the watchdog isn't
  // currently active — `oscWorker` calls this on every tick, and
  // `startClockWatchdog` may run after a few ticks have already
  // landed. Once the watchdog starts it resets `lastTickAt` to
  // its own anchor anyway, so any pre-start update is harmless.
  state.lastTickAt = Date.now();
  if (state.watchdogTimer === null) return;
  state.firstTickSeen = true;
  emitFreshness(true);
}

export function disconnectClockWatchdog(): void {
  stopClockWatchdog();
}

function check(): void {
  if (state.lastTickAt === null || state.tickIntervalMs === null) return;
  const ageMs = Date.now() - state.lastTickAt;
  const allowance = state.firstTickSeen
    ? state.tickIntervalMs * 2
    : STARTUP_GRACE_MS;
  emitFreshness(ageMs < allowance);
}
