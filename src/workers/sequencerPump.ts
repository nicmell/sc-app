/**
 * Worker-side sequencer pump (Phase 32).
 *
 * Owns the timing-critical wake loop for the step sequencer.
 * Uses `setInterval(WAKE_INTERVAL_MS)` inside the worker context,
 * which is NOT throttled when the browser tab is backgrounded —
 * unlike main-thread `setInterval` which Chromium clamps to ~1 Hz.
 *
 * On each pump tick: walks forward from `nextStepTick` to a
 * lookahead horizon, encodes a `/dirt/play` OSC bundle for every
 * active step, ships bytes via the host transport (registered by
 * `oscWorker.ts` via `setSequencerSender`). For each step
 * actually scheduled, posts a `stepFired` event to main at the
 * audible step time so the playhead UI matches the kick.
 *
 * Chain-mode advancement is NOT handled here — it lives on main,
 * driven by `stepFired` events. Worker just plays the active
 * pattern in a loop forever; main switches `bank.activeIndex` at
 * chain boundaries and posts a fresh `sequencerBankUpdate`.
 *
 * Pump math is a verbatim port of `src/sequencer/scheduler.ts pump()`
 * (see Phase 27 plan for the rationale). Constants duplicated here
 * intentionally; `scheduler.ts` is dead code post-32c and gets
 * deleted then.
 */

import OSC from 'osc-js';
import { encode, tickToTimetag } from '@sc-app/server-commands';

import { dirtPlay } from '../dirt/dirtCommands';
import {
  PARAM_NAMES,
  resolveParam,
  type Pattern,
  type Step,
  type Track,
} from '../sequencer/types';
import type {
  SequencerBankSnapshot,
  SequencerClockSnapshot,
  WorkerToMain,
} from '../server/workerProtocol';

/** Lookahead anchor on Play. The first step lands this many ticks
 *  ahead of "now" so the bundle has time to traverse worker → WS
 *  → bridge → UDP → SuperDirt → schedule queue before its fire
 *  time. Mirror of `INITIAL_LOOKAHEAD_TICKS` in the pre-32
 *  main-thread scheduler. */
const INITIAL_LOOKAHEAD_TICKS = 5;

/** Schedule any step within `[now, now + LOOKAHEAD_HORIZON_TICKS]`
 *  on each pump iteration. Larger ⇒ more events on SuperDirt's
 *  queue at a time (more resilient to JS stalls). 5 ticks at
 *  chunkSize 1024 / 48 k tickRate ≈ 47 Hz ⇒ ~106 ms. */
const LOOKAHEAD_HORIZON_TICKS = 5;

/** Wall-clock ms added to every `/dirt/play` timetag (and the
 *  matching `stepFired` post) so SuperDirt sees a positive
 *  `latency = bundle_timetag - sclang_now` and schedules /s_new
 *  bundles in scsynth's audio future, clear of audio-clock drift.
 *  Matches sclang's stock `Server.default.latency`. */
const SUPERDIRT_SAFETY_LOOKAHEAD_MS = 200;

/** Pump cadence. 25 ms (40 Hz) gives a generous safety margin
 *  against worker event-loop stalls, well below the lookahead
 *  horizon. */
const WAKE_INTERVAL_MS = 25;

type Sender = (bytes: Uint8Array) => void;

interface SequencerWorkerState {
  bank: SequencerBankSnapshot | null;
  clock: SequencerClockSnapshot | null;
  isGroupPaused: boolean;
  running: boolean;
  /** Monotonic step counter. `% pattern.length` gives the
   *  display step. Set to 0 on start. */
  nextStepIndex: number;
  /** Fractional tick at which the next step fires. Anchored to
   *  `(start tick + INITIAL_LOOKAHEAD_TICKS)` on Play. */
  nextStepTick: number;
  /** Pending playhead-update timeouts; cancelled on stop so a
   *  rapid stop+start doesn't replay queued playhead events. */
  pendingPlayheadTimers: ReturnType<typeof setTimeout>[];
  /** Wake loop handle. Null while not running. */
  wakeTimer: ReturnType<typeof setInterval> | null;
  /** Pause re-anchor flag. On the first pump after a
   *  paused→running transition, we re-anchor `nextStepTick` to
   *  "now + INITIAL_LOOKAHEAD_TICKS" so resume doesn't fire
   *  every step we skipped during the pause in a catch-up burst.
   *  `nextStepIndex` is preserved (we want playback to continue
   *  from the same step, not jump back to step 0). */
  wasPausedLastPump: boolean;
}

const state: SequencerWorkerState = {
  bank: null,
  clock: null,
  isGroupPaused: false,
  running: false,
  nextStepIndex: 0,
  nextStepTick: 0,
  pendingPlayheadTimers: [],
  wakeTimer: null,
  wasPausedLastPump: false,
};

let sender: Sender | null = null;

/** Registered by `oscWorker.ts` once the WebSocket transport opens
 *  (and cleared on disconnect). The pump calls this directly with
 *  encoded OSC bytes — no second postMessage hop. */
export function setSequencerSender(s: Sender | null): void {
  sender = s;
}

function postToMain(msg: WorkerToMain): void {
  (
    self as unknown as { postMessage: (msg: WorkerToMain) => void }
  ).postMessage(msg);
}

export function handleSequencerStart(args: {
  bank: SequencerBankSnapshot;
  clock: SequencerClockSnapshot;
  isGroupPaused: boolean;
}): void {
  state.bank = args.bank;
  state.clock = args.clock;
  state.isGroupPaused = args.isGroupPaused;
  state.running = true;
  state.wasPausedLastPump = false;

  const tick0Ms = args.clock.tick0Ms;
  if (tick0Ms === null) {
    // Caller (SequencerController.play) gates on tick0Ms !== null,
    // so this should never happen — but if it does, we'd anchor
    // nextStepTick to NaN. Bail visibly.
    console.warn(
      '[sc:sequencer-pump] start with null tick0Ms — refusing to pump',
    );
    state.running = false;
    return;
  }
  const nowTick = ((Date.now() - tick0Ms) * args.clock.tickRate) / 1000;
  state.nextStepIndex = 0;
  state.nextStepTick = nowTick + INITIAL_LOOKAHEAD_TICKS;

  startWakeLoop();
}

export function handleSequencerStop(): void {
  stopWakeLoop();
  cancelPendingPlayheadTimers();
  state.running = false;
  state.wasPausedLastPump = false;
}

export function handleSequencerBankUpdate(bank: SequencerBankSnapshot): void {
  state.bank = bank;
  // Active pattern length may have changed (resize); the
  // `nextStepIndex % pattern.length` step lookup handles that
  // automatically on the next pump.
}

export function handleSequencerClockUpdate(clock: SequencerClockSnapshot): void {
  state.clock = clock;
  // tickRate changes are not expected mid-session (would require
  // sclang restart, which severs the WS). If it ever does change,
  // `nextStepTick` is now anchored against an old rate; the next
  // pump's `nowTick` will be off relative to the queued step. Punt;
  // mid-session tickRate change isn't a supported scenario.
}

export function handleSequencerPauseUpdate(isGroupPaused: boolean): void {
  state.isGroupPaused = isGroupPaused;
}

/** Tear down on disconnect. Stops the wake loop, drops state.
 *  Re-connect is treated as a fresh session — main posts a new
 *  `sequencerStart` if it wants to resume playback. */
export function handleSequencerDisconnect(): void {
  stopWakeLoop();
  cancelPendingPlayheadTimers();
  state.bank = null;
  state.clock = null;
  state.isGroupPaused = false;
  state.running = false;
  state.wasPausedLastPump = false;
}

function startWakeLoop(): void {
  if (state.wakeTimer !== null) return;
  // First pump runs immediately so the initial step lands as soon
  // as possible, then settles into the periodic cadence.
  pumpOnce();
  state.wakeTimer = setInterval(pumpOnce, WAKE_INTERVAL_MS);
}

function stopWakeLoop(): void {
  if (state.wakeTimer === null) return;
  clearInterval(state.wakeTimer);
  state.wakeTimer = null;
}

function cancelPendingPlayheadTimers(): void {
  for (const id of state.pendingPlayheadTimers) {
    clearTimeout(id);
  }
  state.pendingPlayheadTimers = [];
}

function pumpOnce(): void {
  if (!state.running) return;
  if (!state.bank || !state.clock) return;
  if (state.clock.tick0Ms === null) return;
  if (!sender) return;

  const tick0Ms = state.clock.tick0Ms;
  const tickRate = state.clock.tickRate;

  const pattern = state.bank.slots[state.bank.activeIndex];
  if (!pattern) return;

  // Phase 30 pause check: parent group paused ⇒ no /dirt/play
  // emission. The shared clock keeps advancing on sclang's side,
  // but the user's Pause button silences audible output.
  if (state.isGroupPaused) {
    state.wasPausedLastPump = true;
    return;
  }
  // Just un-paused — re-anchor nextStepTick to "now + lookahead"
  // so resume doesn't fire every step the pause window contained
  // in a catch-up burst.
  if (state.wasPausedLastPump) {
    const nowTickBeforeReanchor =
      ((Date.now() - tick0Ms) * tickRate) / 1000;
    state.nextStepTick = nowTickBeforeReanchor + INITIAL_LOOKAHEAD_TICKS;
    cancelPendingPlayheadTimers();
    state.wasPausedLastPump = false;
  }

  const nowMs = Date.now();
  const nowTick = ((nowMs - tick0Ms) * tickRate) / 1000;
  const horizon = nowTick + LOOKAHEAD_HORIZON_TICKS;
  const intervalTicks = stepIntervalTicks(pattern, tickRate);

  while (state.nextStepTick <= horizon) {
    const stepIndex = state.nextStepIndex % pattern.length;
    const targetTick = state.nextStepTick;
    const timetag =
      tickToTimetag(tick0Ms, targetTick, tickRate) +
      SUPERDIRT_SAFETY_LOOKAHEAD_MS;

    for (const track of pattern.tracks) {
      if (!track.sample) continue;
      const step = track.steps[stepIndex];
      if (!step?.active) continue;
      const event = eventForTrack(track, step);
      const bundle = new OSC.Bundle([dirtPlay(event)], timetag);
      sender(encode(bundle));
    }

    // Playhead update: fire at the (shifted) audible step time so
    // UI matches the kick, not the lookahead horizon. Same shift
    // as the OSC timetag keeps UI ↔ audio in lockstep.
    const stepTimeMs =
      tick0Ms +
      (targetTick * 1000) / tickRate +
      SUPERDIRT_SAFETY_LOOKAHEAD_MS;
    const delayMs = Math.max(0, stepTimeMs - nowMs);
    const capturedStepIndex = stepIndex;
    const capturedTargetTick = targetTick;
    const timerId = setTimeout(() => {
      postToMain({
        type: 'stepFired',
        step: {
          stepIndex: capturedStepIndex,
          tick: capturedTargetTick,
          firedAtMs: performance.now(),
        },
      });
      const idx = state.pendingPlayheadTimers.indexOf(timerId);
      if (idx >= 0) state.pendingPlayheadTimers.splice(idx, 1);
    }, delayMs);
    state.pendingPlayheadTimers.push(timerId);

    state.nextStepIndex += 1;
    state.nextStepTick += intervalTicks;
  }
}

function stepIntervalTicks(pattern: Pattern, tickRate: number): number {
  return (60 / pattern.bpm / pattern.subdivision) * tickRate;
}

function eventForTrack(
  track: Track,
  step: Step,
): Record<string, string | number> {
  const event: Record<string, string | number> = {
    s: track.sample,
    gain: track.gain,
  };
  for (const name of PARAM_NAMES) {
    const value = resolveParam(track, step, name);
    if (value !== undefined) event[name] = value;
  }
  return event;
}
