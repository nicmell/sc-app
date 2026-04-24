// Byte-parity between typed builders and the low-level addUgen path for
// the three fixtures in the fixture set.
// This doesn't need sclang — it proves the generated builders produce
// the exact same bytes as the hand-assembled reference graphs.

import { expect, test } from 'vitest';

import { SynthDef, k, u } from '../src/index.js';
import {
  A2K,
  BufWr,
  Impulse,
  In,
  Out,
  Phasor,
  SendTrig,
  SinOsc,
} from '../src/builders/index.js';

// Constants mirrored from src/constants/osc.ts — same values as the Rust example.
const PHASE_BUS = 1000;
const SHARED_FRAMES = 8192;
const CLOCK_TRIGGER_ID = 4242;

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ── Fixture: sine ─────────────────────────────────────────────────────────

function buildSineTyped(): Uint8Array {
  const def = new SynthDef('sine');
  const freq = def.addControl('freq', 440, 'control');
  const osc = SinOsc.ar().freq(freq).phase(0).build(def);
  Out.ar().bus(0).channelsArray([osc]).build(def);
  return def.toBytes();
}

function buildSineLowLevel(): Uint8Array {
  const def = new SynthDef('sine');
  const freq = def.addControl('freq', 440, 'control');
  const osc = def.addUgen('SinOsc', 'audio', [freq, k(0)], 1, 0);
  def.addUgen('Out', 'audio', [k(0), u(osc)], 0, 0);
  return def.toBytes();
}

// ── Fixture: sc_test_recorder ────────────────────────────────────────────

function buildRecorderTyped(): Uint8Array {
  const def = new SynthDef('__sc_test_rec__');
  const bus = def.addControl('bus', 0, 'control');
  const bufnum = def.addControl('bufnum', 0, 'control');
  const phaseBus = def.addControl('phaseBus', 0, 'control');
  const audio = In.ar().bus(bus).numChannels(1).build(def);
  const phase = In.ar().bus(phaseBus).numChannels(1).build(def);
  BufWr.ar()
    .bufnum(bufnum)
    .phase(phase)
    .loop(1)
    .inputArray([audio])
    .build(def);
  return def.toBytes();
}

function buildRecorderLowLevel(): Uint8Array {
  const def = new SynthDef('__sc_test_rec__');
  const bus = def.addControl('bus', 0, 'control');
  const bufnum = def.addControl('bufnum', 0, 'control');
  const phaseBus = def.addControl('phaseBus', 0, 'control');
  const audio = def.addUgen('In', 'audio', [bus], 1, 0);
  const phase = def.addUgen('In', 'audio', [phaseBus], 1, 0);
  // BufWr input order: bufnum, phase, loop, then inputArray (wire-last).
  def.addUgen(
    'BufWr',
    'audio',
    [bufnum, u(phase), k(1), u(audio)],
    1,
    0,
  );
  return def.toBytes();
}

// ── Fixture: global_clock_phase ──────────────────────────────────────────

function buildClockTyped(): Uint8Array {
  const def = new SynthDef('__global_clock__');
  const phase = Phasor.ar()
    .trig(0)
    .rate(1)
    .start(0)
    .end(SHARED_FRAMES)
    .resetPos(0)
    .build(def);
  Out.ar().bus(PHASE_BUS).channelsArray([phase]).build(def);
  const pkr = A2K.kr().in(phase).build(def);
  const tick = Impulse.kr().freq(10).phase(0).build(def);
  SendTrig.kr().in(tick).id(CLOCK_TRIGGER_ID).value(pkr).build(def);
  return def.toBytes();
}

function buildClockLowLevel(): Uint8Array {
  const def = new SynthDef('__global_clock__');
  const phase = def.addUgen(
    'Phasor',
    'audio',
    [k(0), k(1), k(0), k(SHARED_FRAMES), k(0)],
    1,
    0,
  );
  def.addUgen('Out', 'audio', [k(PHASE_BUS), u(phase)], 0, 0);
  const pkr = def.addUgen('A2K', 'control', [u(phase)], 1, 0);
  const tick = def.addUgen('Impulse', 'control', [k(10), k(0)], 1, 0);
  def.addUgen(
    'SendTrig',
    'control',
    [u(tick), k(CLOCK_TRIGGER_ID), u(pkr)],
    0,
    0,
  );
  return def.toBytes();
}

// ── Tests ────────────────────────────────────────────────────────────────

test('sine: typed builders match low-level path', () => {
  expect(bytesEqual(buildSineTyped(), buildSineLowLevel())).toBe(true);
});

test('sc_test_recorder: typed builders match low-level path', () => {
  expect(bytesEqual(buildRecorderTyped(), buildRecorderLowLevel())).toBe(true);
});

test('global_clock_phase: typed builders match low-level path', () => {
  expect(bytesEqual(buildClockTyped(), buildClockLowLevel())).toBe(true);
});

test.each([
  { name: 'sine', build: buildSineTyped },
  { name: 'sc_test_recorder', build: buildRecorderTyped },
  { name: 'global_clock_phase', build: buildClockTyped },
])('$name: bytes round-trip through parser', ({ build }) => {
  const a = build();
  const b = SynthDef.fromBytes(a).toBytes();
  expect(bytesEqual(a, b)).toBe(true);
});
