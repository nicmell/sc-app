/**
 * Worker-side sequencer pump (Phase 32, in flight).
 *
 * 32a — STUB. This module receives the protocol messages and
 * logs them. It does not yet emit OSC bundles or post `stepFired`
 * back to main. The real pump loop (ported from
 * `src/sequencer/scheduler.ts pump()`) lands in 32b.
 *
 * Folded into the existing OSC worker context so it can call
 * `transport.send()` directly without a second postMessage hop
 * once 32b wires emission. For now the only side effect is
 * console output.
 */

import type {
  SequencerBankSnapshot,
  SequencerClockSnapshot,
} from '../server/workerProtocol';

interface SequencerState {
  bank: SequencerBankSnapshot | null;
  clock: SequencerClockSnapshot | null;
  isGroupPaused: boolean;
  running: boolean;
}

const state: SequencerState = {
  bank: null,
  clock: null,
  isGroupPaused: false,
  running: false,
};

export function handleSequencerStart(args: {
  bank: SequencerBankSnapshot;
  clock: SequencerClockSnapshot;
  isGroupPaused: boolean;
}): void {
  state.bank = args.bank;
  state.clock = args.clock;
  state.isGroupPaused = args.isGroupPaused;
  state.running = true;
  console.log(
    `[sc:sequencer-worker] start — slots=${args.bank.slots.length} ` +
      `activeIndex=${args.bank.activeIndex} ` +
      `tickRate=${args.clock.tickRate.toFixed(2)} ` +
      `chunkSize=${args.clock.chunkSize} ` +
      `paused=${args.isGroupPaused}`,
  );
}

export function handleSequencerStop(): void {
  state.running = false;
  console.log('[sc:sequencer-worker] stop');
}

export function handleSequencerBankUpdate(bank: SequencerBankSnapshot): void {
  state.bank = bank;
  console.log(
    `[sc:sequencer-worker] bank update — activeIndex=${bank.activeIndex} ` +
      `chainEnabled=${bank.chain.enabled} chainSteps=${bank.chain.steps.length}`,
  );
}

export function handleSequencerClockUpdate(clock: SequencerClockSnapshot): void {
  state.clock = clock;
  console.log(
    `[sc:sequencer-worker] clock update — tick0Ms=${clock.tick0Ms} ` +
      `tickRate=${clock.tickRate.toFixed(2)} chunkSize=${clock.chunkSize}`,
  );
}

export function handleSequencerPauseUpdate(isGroupPaused: boolean): void {
  state.isGroupPaused = isGroupPaused;
  console.log(`[sc:sequencer-worker] pause update — paused=${isGroupPaused}`);
}

/** Tear down on disconnect. Called from `oscWorker.ts`'s
 *  `disconnect` case so the sequencer state doesn't survive a
 *  WS close (keeps re-connect semantics clean for 32b/c). */
export function handleSequencerDisconnect(): void {
  state.bank = null;
  state.clock = null;
  state.isGroupPaused = false;
  state.running = false;
}
