import {CLOCK_TRIGGER_ID, PHASE_BUS, SHARED_FRAMES} from '@/constants/osc';
import {compileSynthDef} from '@/lib/synthdef';
import {oscService} from '@/lib/osc';
import type {UGenSpec} from '@/types/parsers';

/**
 * App-wide phase broadcaster. One synth per scsynth connection, running at
 * the head of the default group. Publishes its `Phasor.ar` phase on
 * `PHASE_BUS` so every phase-tracked buffer writer (currently sc-test) can
 * read it via `In.ar(PHASE_BUS)` — no per-buffer Phasor needed. Emits `/tr`
 * tagged with `CLOCK_TRIGGER_ID` at 10 Hz so the Rust `ClockService` can
 * drift-correct its extrapolation.
 *
 * `/d_recv` is re-sent every connect so scsynth restarts are transparent.
 * Compiled bytes cache module-wide (compilation is deterministic).
 */
const CLOCK_SYNTH_NAME = '__global_clock__';

let clockBytes: number[] | null = null;
let clockNodeId = 0;

function buildSynthdef(): number[] {
    const specs = new Map<string, UGenSpec>([
        ['phase', {name: 'phase', type: 'Phasor', rate: 'ar',
                   inputs: {trig: '0', rate: '1', start: '0',
                            end: String(SHARED_FRAMES), resetPos: '0'}}],
        ['out',   {name: 'out',   type: 'Out',    rate: 'ar',
                   inputs: {bus: String(PHASE_BUS), channelsArray: 'phase'}}],
        ['pkr',   {name: 'pkr',   type: 'A2K',    rate: 'kr',
                   inputs: {in: 'phase'}}],
        // 10 Hz is plenty for drift correction — DSP vs wall-clock drift
        // at tens of ppm over 100 ms is well under one sample. Re-anchoring
        // that often also keeps recovery from pause/resume snappy.
        ['tick',  {name: 'tick',  type: 'Impulse', rate: 'kr',
                   inputs: {freq: '10', phase: '0'}}],
        ['reply', {name: 'reply', type: 'SendTrig', rate: 'kr',
                   inputs: {in: 'tick', id: String(CLOCK_TRIGGER_ID), value: 'pkr'}}],
    ]);
    return compileSynthDef(CLOCK_SYNTH_NAME, {}, specs);
}

/** Send the broadcaster synthdef and spawn it at the HEAD of the default
 *  group. HEAD placement is load-bearing: the broadcaster's `Out.ar` must
 *  finish writing `PHASE_BUS` before any consumer `BufWr` in the same block
 *  reads it. */
export async function startGlobalClock(defaultGroupId: number): Promise<void> {
    if (!clockBytes) clockBytes = buildSynthdef();
    await oscService.sendSynthDef(Uint8Array.from(clockBytes));
    const nodeId = oscService.nextNodeId();
    await oscService.createSynthAtHead(CLOCK_SYNTH_NAME, nodeId, defaultGroupId, {});
    clockNodeId = nodeId;
}

/** Free the broadcaster synth. Safe to call when none is running. */
export async function stopGlobalClock(): Promise<void> {
    if (clockNodeId > 0) {
        try { await oscService.freeSynth(clockNodeId); } catch { /* already gone */ }
        clockNodeId = 0;
    }
}
