/**
 * Phase 33b — unit tests for the worker-side clock watchdog.
 *
 * Tests the freshness-detection state machine in isolation. Vitest
 * fake timers control `setInterval` + `performance.now()` so runs
 * are deterministic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  disconnectClockWatchdog,
  recordClockTick,
  startClockWatchdog,
  stopClockWatchdog,
} from './clockWatchdog';

const TICK_INTERVAL_MS = 21; // approx default config (1024 / 48 k)

describe('clockWatchdog', () => {
  let postedToMain: Array<{ type: string; fresh?: boolean }>;

  beforeEach(() => {
    disconnectClockWatchdog();
    vi.useFakeTimers();
    vi.setSystemTime(0);

    postedToMain = [];
    (
      globalThis as unknown as {
        postMessage: (m: { type: string; fresh?: boolean }) => void;
      }
    ).postMessage = (m) => {
      postedToMain.push(m);
    };
  });

  afterEach(() => {
    disconnectClockWatchdog();
    vi.useRealTimers();
  });

  function freshnessEvents(): boolean[] {
    return postedToMain
      .filter((m) => m.type === 'clockFreshness')
      .map((m) => m.fresh as boolean);
  }

  it('emits an initial fresh:true on start', () => {
    startClockWatchdog(TICK_INTERVAL_MS);
    expect(freshnessEvents()).toEqual([true]);
  });

  it('flips to stale when no ticks arrive past the startup grace', () => {
    startClockWatchdog(TICK_INTERVAL_MS);
    // STARTUP_GRACE_MS = 500. Advance past it; the next watchdog
    // check should observe ageMs > grace and emit stale.
    vi.advanceTimersByTime(700);
    const events = freshnessEvents();
    expect(events).toEqual([true, false]);
  });

  it('flips back to fresh on recordClockTick', () => {
    startClockWatchdog(TICK_INTERVAL_MS);
    vi.advanceTimersByTime(700);
    expect(freshnessEvents()).toEqual([true, false]);

    recordClockTick();
    expect(freshnessEvents()).toEqual([true, false, true]);
  });

  it('only emits on transitions, not every check', () => {
    startClockWatchdog(TICK_INTERVAL_MS);
    // Steady stream of ticks — fresh state should emit ONCE
    // (the initial start emit), no more.
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(TICK_INTERVAL_MS);
      recordClockTick();
    }
    expect(freshnessEvents()).toEqual([true]);
  });

  it('post-first-tick allowance is 2× tickIntervalMs', () => {
    startClockWatchdog(TICK_INTERVAL_MS);
    recordClockTick(); // mark first real tick; allowance switches
    expect(freshnessEvents()).toEqual([true]);

    // 2 × tickIntervalMs = 42 ms. Just under: still fresh.
    vi.advanceTimersByTime(40);
    expect(freshnessEvents()).toEqual([true]);
    // Just past: stale.
    vi.advanceTimersByTime(20); // total 60 ms since the last tick
    expect(freshnessEvents()).toEqual([true, false]);
  });

  it('stopClockWatchdog clears the interval and stops emitting', () => {
    startClockWatchdog(TICK_INTERVAL_MS);
    stopClockWatchdog();
    const before = freshnessEvents().length;
    vi.advanceTimersByTime(2000);
    expect(freshnessEvents().length).toBe(before);
  });

  it('disconnectClockWatchdog is a stop alias', () => {
    startClockWatchdog(TICK_INTERVAL_MS);
    disconnectClockWatchdog();
    const before = freshnessEvents().length;
    vi.advanceTimersByTime(2000);
    expect(freshnessEvents().length).toBe(before);
    expect(() => disconnectClockWatchdog()).not.toThrow();
  });

  it('recordClockTick before startClockWatchdog updates anchor without emitting', () => {
    // Some `/clock/tick` events may decode in the worker before
    // `ClockController.attach` posts `clockWatchdogStart`. The
    // pre-start tick should not crash and should not emit.
    expect(() => recordClockTick()).not.toThrow();
    expect(freshnessEvents()).toEqual([]);
  });

  it('restart resets state cleanly', () => {
    startClockWatchdog(TICK_INTERVAL_MS);
    vi.advanceTimersByTime(700);
    expect(freshnessEvents()).toEqual([true, false]);

    // Restart: should emit fresh:true again as the new initial state.
    startClockWatchdog(TICK_INTERVAL_MS);
    expect(freshnessEvents()).toEqual([true, false, true]);
  });
});
