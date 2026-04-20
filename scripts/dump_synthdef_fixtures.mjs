#!/usr/bin/env node

// Emit parity fixtures for `scsynthdef-compiler`. Three fixtures, each a
// pair of files under crates/scsynthdef-compiler/fixtures/<name>/:
//   - spec.json   — input for Rust's `compile_synthdef` (name + params + specs)
//   - sclang.scd  — equivalent SC source that writes <name>.scsyndef
//
// The three cases:
//   - sine                  exemplar: single-param SinOsc → Out
//   - sc_test_recorder      mirrors src/sc-elements/sc-test.ts:33-51
//   - global_clock_phase    mirrors src/lib/clock/globalClock.ts:22-40
//
// Constants from src/constants/osc.ts are inlined so this script has no
// dependency on the app source.
//
// Usage: node scripts/dump_synthdef_fixtures.mjs

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_ROOT = join(ROOT, 'crates', 'scsynthdef-compiler', 'fixtures');

// ── Constants mirrored from src/constants/osc.ts ─────────────────────────
const CLOCK_TRIGGER_ID = 4242;
const PHASE_BUS = 1000;
const SHARED_FRAMES = 8192;

// ── Fixture definitions ──────────────────────────────────────────────────

const fixtures = [
  {
    name: 'sine',
    synthdefName: 'sine',
    params: [['freq', 440]],
    specs: [
      { name: 'osc', type: 'SinOsc', rate: 'ar',
        inputs: { freq: 'freq', phase: '0' } },
      { name: 'out', type: 'Out', rate: 'ar',
        inputs: { bus: '0', channelsArray: 'osc' } },
    ],
    // Simple SC source — single-param kr control. sclang will group the lone
    // control, but with only one param it's structurally the same as our
    // single-Control encoding.
    sc: `
SynthDef(\\sine, { |freq = 440|
    Out.ar(0, SinOsc.ar(freq, 0))
}).writeDefFile(thisProcess.nowExecutingPath.dirname);
0.exit;
`.trim(),
  },

  {
    name: 'sc_test_recorder',
    synthdefName: '__sc_test_rec__',
    params: [['bus', 0], ['bufnum', 0], ['phaseBus', 0]],
    specs: [
      { name: 'audio', type: 'In', rate: 'ar',
        inputs: { bus: 'bus', numChannels: '1' } },
      { name: 'phase', type: 'In', rate: 'ar',
        inputs: { bus: 'phaseBus', numChannels: '1' } },
      { name: 'write', type: 'BufWr', rate: 'ar',
        inputs: { inputArray: 'audio', bufnum: 'bufnum',
                  phase: 'phase', loop: '1' } },
    ],
    sc: `
SynthDef(\\__sc_test_rec__, { |bus = 0, bufnum = 0, phaseBus = 0|
    var audio = In.ar(bus, 1);
    var phase = In.ar(phaseBus, 1);
    BufWr.ar(audio, bufnum, phase, 1);
}).writeDefFile(thisProcess.nowExecutingPath.dirname);
0.exit;
`.trim(),
  },

  {
    name: 'global_clock_phase',
    synthdefName: '__global_clock__',
    params: [],
    specs: [
      { name: 'phase', type: 'Phasor', rate: 'ar',
        inputs: { trig: '0', rate: '1', start: '0',
                  end: String(SHARED_FRAMES), resetPos: '0' } },
      { name: 'out', type: 'Out', rate: 'ar',
        inputs: { bus: String(PHASE_BUS), channelsArray: 'phase' } },
      { name: 'pkr', type: 'A2K', rate: 'kr',
        inputs: { in: 'phase' } },
      { name: 'tick', type: 'Impulse', rate: 'kr',
        inputs: { freq: '10', phase: '0' } },
      { name: 'reply', type: 'SendTrig', rate: 'kr',
        inputs: { in: 'tick', id: String(CLOCK_TRIGGER_ID), value: 'pkr' } },
    ],
    // All `var`s declared together at the top — sclang rejects interleaved
    // var/statement sequences, which otherwise hangs the script before
    // `0.exit` fires.
    sc: `
SynthDef(\\__global_clock__, {
    var phase, pkr, tick;
    phase = Phasor.ar(0, 1, 0, ${SHARED_FRAMES}, 0);
    Out.ar(${PHASE_BUS}, phase);
    pkr = A2K.kr(phase);
    tick = Impulse.kr(10, 0);
    SendTrig.kr(tick, ${CLOCK_TRIGGER_ID}, pkr);
}).writeDefFile(thisProcess.nowExecutingPath.dirname);
0.exit;
`.trim(),
  },
];

// ── Emit ─────────────────────────────────────────────────────────────────

if (existsSync(OUT_ROOT)) rmSync(OUT_ROOT, { recursive: true, force: true });
mkdirSync(OUT_ROOT, { recursive: true });

for (const fx of fixtures) {
  const dir = join(OUT_ROOT, fx.name);
  mkdirSync(dir, { recursive: true });

  const spec = {
    name: fx.synthdefName,
    params: fx.params,
    specs: fx.specs,
  };
  writeFileSync(join(dir, 'spec.json'), JSON.stringify(spec, null, 2) + '\n');
  writeFileSync(join(dir, 'sclang.scd'), fx.sc + '\n');
  console.log(`  ${fx.name}/  (${fx.specs.length} ugens, ${fx.params.length} params)`);
}

console.log(`\nWrote ${fixtures.length} fixtures to ${OUT_ROOT}`);
