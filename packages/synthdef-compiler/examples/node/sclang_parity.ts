#!/usr/bin/env tsx
// sclang parity harness. Builds the three fixtures (sine,
// sc_test_recorder, global_clock_phase) via the typed `builders/*`
// API and byte-diffs the output against sclang's SCgf v2 encoder.
// Skips cleanly if sclang is not on $PATH.
//
// Usage:
//     yarn parity

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SynthDef, parseScgf } from '../../src/index.js';
import {
  A2K,
  BufWr,
  Impulse,
  In,
  Out,
  Phasor,
  SendTrig,
  SinOsc,
} from '../../src/builders/index.js';

// ── Constants mirrored from src/constants/osc.ts ──────────────────────────
const PHASE_BUS = 1000;
const SHARED_FRAMES = 8192;
const CLOCK_TRIGGER_ID = 4242;

// ── Fixture definitions ──────────────────────────────────────────────────

interface Fixture {
  /** Used both to find `fixtures/<name>.scd` and as the SynthDef name. */
  name: string;
  build: () => Uint8Array;
}

function fixtureSine(): Fixture {
  return {
    name: 'sine',
    build: () => {
      const def = new SynthDef('sine');
      const freq = def.addControl('freq', 440, 'control');
      const osc = SinOsc.ar().freq(freq).phase(0).build(def);
      Out.ar().bus(0).channelsArray([osc]).build(def);
      return def.toBytes();
    },
  };
}

function fixtureScTestRecorder(): Fixture {
  return {
    name: 'sc_test_recorder',
    build: () => {
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
    },
  };
}

function fixtureGlobalClockPhase(): Fixture {
  return {
    name: 'global_clock_phase',
    build: () => {
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
  const dir = mkdtempSync(join(tmpdir(), `sclang_parity_${synthDefName}_`));
  try {
    const script = join(dir, 'sclang.scd');
    copyFileSync(scdPath, script);
    execFileSync('sclang', [script], { stdio: 'pipe' });
    const defPath = join(dir, `${synthDefName}.scsyndef`);
    if (!existsSync(defPath)) {
      throw new Error(`sclang did not produce ${defPath}`);
    }
    return new Uint8Array(readFileSync(defPath));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── Diff helpers ─────────────────────────────────────────────────────────

function findMismatch(a: Uint8Array, b: Uint8Array): number | null {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length !== b.length ? n : null;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function hexLine(label: string, bytes: Uint8Array, offset: number, width: number): string {
  const end = Math.min(offset + width, bytes.length);
  const parts: string[] = [];
  for (let i = offset; i < end; i++) parts.push(bytes[i].toString(16).padStart(2, '0'));
  const addr = `0x${offset.toString(16).padStart(4, '0')}`;
  return `  ${label.padEnd(8)} @ ${addr}  ${parts.join(' ')}`;
}

function dumpDiffContext(ours: Uint8Array, sclang: Uint8Array, offset: number): void {
  const start = Math.max(0, offset - 4);
  console.log(hexLine('ours', ours, start, 24));
  console.log(hexLine('sclang', sclang, start, 24));
}

// ── Main loop ───────────────────────────────────────────────────────────

function fixturesDir(): string {
  // Script lives at examples/node/sclang_parity.ts; fixtures at ../fixtures/.
  const here = dirname(fileURLToPath(import.meta.url));
  return resolvePath(here, '..', 'fixtures');
}

function run(): number {
  console.log('sclang parity harness (TypeScript)');
  console.log('==================================');

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

    // sclang uses the SynthDef's own name to find the emitted `.scsyndef`.
    // Read it back from the bytes we just compiled.
    const synthDefName = SynthDef.fromBytes(ours).name();

    let sclang: Uint8Array;
    try {
      sclang = sclangBytes(scdPath, synthDefName);
    } catch (e) {
      console.log(`  sclang: ${(e as Error).message}`);
      mismatches++;
      continue;
    }

    if (bytesEqual(ours, sclang)) {
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

    try {
      const sclangJson = parseScgf(sclang);
      const oursJson = parseScgf(ours);
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
