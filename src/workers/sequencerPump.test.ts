/**
 * Phase 32d — unit tests for the worker-side sequencer pump.
 *
 * Tests the timing-critical pump in isolation: feed a fake clock
 * + bank, drive the worker's wake loop with vitest fake timers,
 * assert what bytes the sender would have shipped to the WS.
 *
 * Module state is reset in `beforeEach` via
 * `handleSequencerDisconnect()` + `setSequencerSender(null)`.
 * Vitest fake timers control `Date.now()` and `setInterval` /
 * `setTimeout` so test runs are deterministic.
 */

import { decode, isBundle, isMessage } from '@sc-app/server-commands';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  handleSequencerBankUpdate,
  handleSequencerDisconnect,
  handleSequencerPauseUpdate,
  handleSequencerStart,
  handleSequencerStop,
  setSequencerSender,
} from './sequencerPump';
import {
  makeEmptyChain,
  makeEmptyPattern,
  makeEmptyTrack,
  type ChainState,
  type Pattern,
} from '../sequencer/types';
import type {
  SequencerBankSnapshot,
  SequencerClockSnapshot,
} from '../server/workerProtocol';

const TICK_RATE = 47;
const TICK0_MS = -200; // tick 0 was 200ms before Date.now()=0 ⇒ nowTick ≈ 9.4
const CHUNK_SIZE = 1024;
const SAMPLE_RATE = 48000;
const WAKE_INTERVAL_MS = 25;

function buildClock(): SequencerClockSnapshot {
  return {
    tick0Ms: TICK0_MS,
    tickRate: TICK_RATE,
    chunkSize: CHUNK_SIZE,
    sampleRate: SAMPLE_RATE,
  };
}

function buildBank(pattern: Pattern, chain?: ChainState): SequencerBankSnapshot {
  return {
    slots: [pattern],
    activeIndex: 0,
    chain: chain ?? makeEmptyChain(),
  };
}

/** Pattern at 120 BPM with one track (sample `bd`) and EVERY
 *  step active. Dense pattern so the sender fires once per
 *  step boundary; at BPM 120 / subdivision 4 / tickRate 47 the
 *  step interval is `(60/120/4) * 47 = 5.875` ticks ≈ 125 ms,
 *  i.e. 8 sender calls per wall-clock second. The "single kick"
 *  variant (only step 0 active) made sender fire every
 *  pattern.length × stepInterval = 2 s, which trips up
 *  short-window timing assertions. */
function densePattern(sample = 'bd'): Pattern {
  const pattern = makeEmptyPattern(16);
  const track = makeEmptyTrack(16, sample);
  track.steps = track.steps.map(() => ({ active: true }));
  return { ...pattern, bpm: 120, tracks: [track] };
}

describe('sequencerPump', () => {
  let sentBytes: Uint8Array[];
  let postedToMain: unknown[];

  beforeEach(() => {
    handleSequencerDisconnect();
    setSequencerSender(null);
    vi.useFakeTimers();
    vi.setSystemTime(0);

    sentBytes = [];
    postedToMain = [];
    setSequencerSender((bytes) => sentBytes.push(bytes));
    (globalThis as unknown as { postMessage: (m: unknown) => void }).postMessage = (
      m,
    ) => {
      postedToMain.push(m);
    };
  });

  afterEach(() => {
    handleSequencerDisconnect();
    setSequencerSender(null);
    vi.useRealTimers();
  });

  it('emits one /dirt/play bundle per active step on start', () => {
    handleSequencerStart({
      bank: buildBank(densePattern()),
      clock: buildClock(),
      isGroupPaused: false,
    });

    // The wake loop runs `pumpOnce` immediately on start. The
    // first step is anchored at `nowTick + INITIAL_LOOKAHEAD_TICKS`
    // which equals the horizon, so exactly one step fires this
    // pump.
    expect(sentBytes).toHaveLength(1);

    const packet = decode(sentBytes[0]);
    expect(isBundle(packet)).toBe(true);
    if (!isBundle(packet)) return;
    expect(packet.bundleElements).toHaveLength(1);
    const inner = packet.bundleElements[0];
    expect(isMessage(inner)).toBe(true);
    if (!isMessage(inner)) return;
    expect(inner.address).toBe('/dirt/play');
    // /dirt/play args are flat key/value pairs. We expect at
    // least `s, 'bd', gain, 0.8`.
    const argMap = new Map<string, string | number>();
    for (let i = 0; i < inner.args.length; i += 2) {
      argMap.set(inner.args[i] as string, inner.args[i + 1] as string | number);
    }
    expect(argMap.get('s')).toBe('bd');
    // gain round-trips through float32 encoding so 0.8 comes back
    // as the nearest f32 representation. Use toBeCloseTo for the
    // ε rather than nailing the binary representation.
    expect(argMap.get('gain') as number).toBeCloseTo(0.8, 5);
  });

  it('emits multiple bundles as the wake loop advances', () => {
    handleSequencerStart({
      bank: buildBank(densePattern()),
      clock: buildClock(),
      isGroupPaused: false,
    });
    expect(sentBytes).toHaveLength(1);

    // Advance ~1 s of wall time. At BPM 120 / subdivision 4 the
    // step rate is 8 Hz, so we expect roughly 8 more bundles —
    // exact count varies by ±1 depending on where the 5.875-tick
    // step interval lands across 25-ms wake quanta. We bracket
    // loosely: just confirm the wake loop is firing and
    // emissions keep coming.
    vi.advanceTimersByTime(1000);
    expect(sentBytes.length).toBeGreaterThanOrEqual(5);
  });

  it('skips emission while paused', () => {
    handleSequencerStart({
      bank: buildBank(densePattern()),
      clock: buildClock(),
      isGroupPaused: false,
    });
    const initialCount = sentBytes.length;

    handleSequencerPauseUpdate(true);
    vi.advanceTimersByTime(2000); // 2 s paused
    expect(sentBytes).toHaveLength(initialCount);

    // Un-pause: re-anchors `nextStepTick` to nowTick+lookahead,
    // so the next pump does NOT replay the missed steps in a
    // catch-up burst — it schedules the FIRST step ahead of
    // "now". After enough wake intervals the re-anchored step
    // crosses the horizon and fresh bundles go out.
    handleSequencerPauseUpdate(false);
    vi.advanceTimersByTime(1000); // 1 s of running, ≥ 5 steps
    expect(sentBytes.length).toBeGreaterThanOrEqual(initialCount + 5);
  });

  it('stops emitting after handleSequencerStop', () => {
    handleSequencerStart({
      bank: buildBank(densePattern()),
      clock: buildClock(),
      isGroupPaused: false,
    });
    handleSequencerStop();
    const count = sentBytes.length;
    vi.advanceTimersByTime(WAKE_INTERVAL_MS * 20);
    expect(sentBytes).toHaveLength(count);
  });

  it('disconnect clears the wake timer', () => {
    handleSequencerStart({
      bank: buildBank(densePattern()),
      clock: buildClock(),
      isGroupPaused: false,
    });
    handleSequencerDisconnect();
    const count = sentBytes.length;
    vi.advanceTimersByTime(WAKE_INTERVAL_MS * 20);
    expect(sentBytes).toHaveLength(count);
    // Calling disconnect twice is a no-op (idempotent).
    expect(() => handleSequencerDisconnect()).not.toThrow();
  });

  it('refuses to pump when start arrives with null tick0Ms', () => {
    const clock = buildClock();
    clock.tick0Ms = null;
    handleSequencerStart({
      bank: buildBank(densePattern()),
      clock,
      isGroupPaused: false,
    });
    vi.advanceTimersByTime(WAKE_INTERVAL_MS * 10);
    expect(sentBytes).toHaveLength(0);
  });

  it('posts stepFired events to main', () => {
    handleSequencerStart({
      bank: buildBank(densePattern()),
      clock: buildClock(),
      isGroupPaused: false,
    });

    // The pump sets a setTimeout to post `stepFired` at the
    // (audible) step time. Advance well past the lookahead +
    // SUPERDIRT_SAFETY_LOOKAHEAD_MS = 200 to flush all pending
    // playhead timers.
    vi.advanceTimersByTime(2000);

    const stepFiredEvents = postedToMain.filter(
      (m): m is { type: 'stepFired'; step: { stepIndex: number } } =>
        typeof m === 'object' &&
        m !== null &&
        (m as { type: string }).type === 'stepFired',
    );
    expect(stepFiredEvents.length).toBeGreaterThanOrEqual(1);
    // The active step in the test pattern is at index 0; the
    // FIRST scheduled step is at `nextStepIndex=0 → stepIndex=0`.
    expect(stepFiredEvents[0].step.stepIndex).toBe(0);
  });

  it('picks up bank updates without restart', () => {
    handleSequencerStart({
      bank: buildBank(densePattern()),
      clock: buildClock(),
      isGroupPaused: false,
    });
    const initialCount = sentBytes.length;

    // Replace the active pattern with one whose track sample
    // is `sn` instead of `bd`. The pump should adopt the new
    // pattern from the next iteration.
    handleSequencerBankUpdate(buildBank(densePattern('sn')));
    vi.advanceTimersByTime(1000); // 1 s of running, ≥ 5 steps

    // Find the most recent bundle's sample arg.
    expect(sentBytes.length).toBeGreaterThan(initialCount);
    const lastPacket = decode(sentBytes[sentBytes.length - 1]);
    if (!isBundle(lastPacket)) throw new Error('expected bundle');
    const inner = lastPacket.bundleElements[0];
    if (!isMessage(inner)) throw new Error('expected message');
    const argMap = new Map<string, string | number>();
    for (let i = 0; i < inner.args.length; i += 2) {
      argMap.set(inner.args[i] as string, inner.args[i + 1] as string | number);
    }
    expect(argMap.get('s')).toBe('sn');
  });
});
