#!/usr/bin/env tsx
// Parity harness mirroring `crates/scsynthdef-compiler/examples/sclang_parity.rs`.
//
// Uses the jco-transpiled component bindings (see ../frontend/pkg in this
// repo's build tree) to build three fixtures — sine, sc_test_recorder,
// global_clock_phase — via the `core::SynthDef` resource's `addUgen` /
// `addControl` methods, then runs each fixture's `.scd` file through
// sclang and byte-diffs the output.
//
// Usage:
//     npm run build:component
//     npm run parity

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { core } from './pkg/scsynthdef_compiler.js';
import type { Rate, UgenInput } from './pkg/interfaces/scsynthdef-compiler-core.js';

const { SynthDef, parseScgf } = core;

// ── Constants mirrored from src/constants/osc.ts ──────────────────────────
const PHASE_BUS = 1000;
const SHARED_FRAMES = 8192;
const CLOCK_TRIGGER_ID = 4242;

// ── UgenInput helpers ────────────────────────────────────────────────────
const k = (v: number): UgenInput => ({ tag: 'constant', val: v });
const u = (i: number): UgenInput => ({ tag: 'ugen', val: i });

// ── Fixture definitions ──────────────────────────────────────────────────

interface Fixture {
  name: string;
  synthDefName: string;
  build: () => Uint8Array;
}

function fixtureSine(): Fixture {
  return {
    name: 'sine',
    synthDefName: 'sine',
    build: () => {
      const def = new SynthDef('sine');
      const freq = def.addControl('freq', 440, 'control');
      const osc = def.addUgen('SinOsc', 'audio', [freq, k(0)], 1, 0);
      def.addUgen('Out', 'audio', [k(0), u(osc)], 0, 0);
      return def.toBytes();
    },
  };
}

function fixtureScTestRecorder(): Fixture {
  return {
    name: 'sc_test_recorder',
    synthDefName: '__sc_test_rec__',
    build: () => {
      const def = new SynthDef('__sc_test_rec__');
      const bus = def.addControl('bus', 0, 'control');
      const bufnum = def.addControl('bufnum', 0, 'control');
      const phaseBus = def.addControl('phaseBus', 0, 'control');
      const audio = def.addUgen('In', 'audio', [bus], 1, 0);
      const phase = def.addUgen('In', 'audio', [phaseBus], 1, 0);
      // BufWr input order: bufnum, phase, loop, then inputArray (wire-last).
      // Note `numOutputs = 1`: sclang emits BufWr with one output (the
      // write-phase); it's not a zero-output "side-effect only" UGen.
      def.addUgen(
        'BufWr',
        'audio',
        [bufnum, u(phase), k(1), u(audio)],
        1,
        0,
      );
      return def.toBytes();
    },
  };
}

function fixtureGlobalClockPhase(): Fixture {
  return {
    name: 'global_clock_phase',
    synthDefName: '__global_clock__',
    build: () => {
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
    },
  };
}

const FIXTURES: Fixture[] = [
  fixtureGlobalClockPhase(),
  fixtureScTestRecorder(),
  fixtureSine(),
];

// ── sclang invocation ────────────────────────────────────────────────────

function sclangAvailable(): boolean {
  try {
    execFileSync('sclang', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function sclangBytes(scdPath: string, synthDefName: string): Uint8Array {
  // Copy the .scd into a fresh tempdir and run sclang there. The .scd's
  // `thisProcess.nowExecutingPath.dirname` resolves to that tempdir, so
  // the compiled `<name>.scsyndef` lands next to the script.
  const dir = mkdtempSync(join(tmpdir(), `sclang_parity_${synthDefName}_`));
  try {
    const script = join(dir, 'sclang.scd');
    copyFileSync(scdPath, script);
    execFileSync('sclang', [script], { stdio: 'pipe' });
    const defPath = join(dir, `${synthDefName}.scsyndef`);
    if (!existsSync(defPath)) {
      throw new Error(`sclang did not produce ${defPath}`);
    }
    return readFileSync(defPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Diff helpers ─────────────────────────────────────────────────────────

function findMismatch(a: Uint8Array, b: Uint8Array): number | null {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return i;
  }
  return a.length !== b.length ? n : null;
}

function hexLine(label: string, bytes: Uint8Array, offset: number, width: number): string {
  const end = Math.min(offset + width, bytes.length);
  const parts: string[] = [];
  for (let i = offset; i < end; i++) parts.push(bytes[i].toString(16).padStart(2, '0'));
  const addr = `0x${offset.toString(16).padStart(4, '0')}`;
  return `  ${label.padEnd(8)} @ ${addr}  ${parts.join(' ')}`;
}

function dumpDiffContext(rust: Uint8Array, sclang: Uint8Array, offset: number): void {
  const start = Math.max(0, offset - 4);
  console.log(hexLine('our', rust, start, 24));
  console.log(hexLine('sclang', sclang, start, 24));
}

// ── Main loop ────────────────────────────────────────────────────────────

function fixturesDir(): string {
  // This file lives at examples/node/sclang_parity.ts; fixtures are at
  // ../fixtures/<name>.scd.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolvePath(here, '..', 'fixtures');
}

function run(): number {
  console.log('sclang parity harness (node + jco bindings)');
  console.log('===========================================');

  if (!sclangAvailable()) {
    console.log('sclang not installed — skipped');
    return 0;
  }

  const dir = fixturesDir();
  let mismatches = 0;

  for (const fx of FIXTURES) {
    console.log(`\n▸ ${fx.name}`);
    const scdPath = join(dir, `${fx.name}.scd`);
    if (!existsSync(scdPath)) {
      console.log(`  (missing ${fx.name}.scd — skipped)`);
      mismatches++;
      continue;
    }

    let ours: Uint8Array;
    try {
      ours = fx.build();
    } catch (e) {
      console.log(`  our build failed: ${(e as Error).message}`);
      mismatches++;
      continue;
    }

    let sclang: Uint8Array;
    try {
      sclang = sclangBytes(scdPath, fx.synthDefName);
    } catch (e) {
      console.log(`  sclang: ${(e as Error).message}`);
      mismatches++;
      continue;
    }

    if (Buffer.compare(Buffer.from(ours), Buffer.from(sclang)) === 0) {
      console.log(`  ✓ byte-identical (${ours.length} bytes)`);
      continue;
    }

    mismatches++;
    console.log(
      `  ✗ diverged (ours: ${ours.length} bytes, sclang: ${sclang.length} bytes)`,
    );
    const off = findMismatch(ours, sclang);
    if (off !== null) {
      console.log(`  first mismatch at offset 0x${off.toString(16)}:`);
      dumpDiffContext(ours, sclang, off);
    }

    // Structural summary via parseScgf — same path the Rust harness uses.
    try {
      const sclangJson = JSON.parse(parseScgf(sclang));
      const oursJson = JSON.parse(parseScgf(ours));
      const names = (j: { ugens: { className: string }[] }) =>
        j.ugens.map((u) => u.className).join(', ');
      console.log('  ── structural summary ──');
      console.log(
        `    ours   : ${oursJson.ugens.length} ugens, ${oursJson.constants.length} constants, ${oursJson.parameters.names.length} params`,
      );
      console.log(`    ours   ugens: ${names(oursJson)}`);
      console.log(
        `    sclang : ${sclangJson.ugens.length} ugens, ${sclangJson.constants.length} constants, ${sclangJson.parameters.names.length} params`,
      );
      console.log(`    sclang ugens: ${names(sclangJson)}`);
    } catch (e) {
      console.log(`  (could not parse bytes for structural diff: ${(e as Error).message})`);
    }
  }

  console.log();
  if (mismatches === 0) {
    console.log('all fixtures matched');
    return 0;
  }
  console.log(`${mismatches} fixture(s) diverged`);
  return 1;
}

process.exit(run());
