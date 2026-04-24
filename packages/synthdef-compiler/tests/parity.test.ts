// End-to-end tests for the spec-level SynthDef encoder / decoder.
//
// Every test exercises the programmatic builder (`SynthDef.addControl`,
// `SynthDef.addUgen`) and the encode / parse round-trips.

import { describe, expect, test } from 'vitest';

import { SynthDef, k, u } from '../src/index.js';
import { Out, SinOsc } from '../src/builders/index.js';

// ── SCgf v2 reader (big-endian) ────────────────────────────────────────────
class Reader {
  private view: DataView;
  private pos = 0;

  constructor(buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  i8(): number {
    const v = this.view.getInt8(this.pos);
    this.pos += 1;
    return v;
  }

  i16(): number {
    const v = this.view.getInt16(this.pos, false);
    this.pos += 2;
    return v;
  }

  i32(): number {
    const v = this.view.getInt32(this.pos, false);
    this.pos += 4;
    return v;
  }

  f32(): number {
    const v = this.view.getFloat32(this.pos, false);
    this.pos += 4;
    return v;
  }

  pstring(): string {
    const len = this.view.getUint8(this.pos);
    this.pos += 1;
    let s = '';
    for (let i = 0; i < len; i++) {
      s += String.fromCharCode(this.view.getUint8(this.pos + i));
    }
    this.pos += len;
    return s;
  }

  position(): number {
    return this.pos;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// ── Tests ──────────────────────────────────────────────────────────────────

/** Minimal `SinOsc.ar(440) → Out.ar(0, …)` built programmatically. */
test('minimal SinOsc + Out via builder', () => {
  const def = new SynthDef('minimal');
  const sin = def.addUgen('SinOsc', 'audio', [k(440), k(0)], 1, 0);
  def.addUgen('Out', 'audio', [k(0), u(sin)], 0, 0);
  const bytes = def.toBytes();

  const r = new Reader(bytes);
  expect(r.i32()).toBe(0x53436766);
  expect(r.i32()).toBe(2);
  expect(r.i16()).toBe(1);
  expect(r.pstring()).toBe('minimal');

  // Constants: 440.0 and 0.0 (first-seen order).
  expect(r.i32()).toBe(2);
  expect(r.f32()).toBe(440.0);
  expect(r.f32()).toBe(0.0);

  // No params.
  expect(r.i32()).toBe(0);
  expect(r.i32()).toBe(0);

  // UGens.
  expect(r.i32()).toBe(2);

  // SinOsc
  expect(r.pstring()).toBe('SinOsc');
  expect(r.i8()).toBe(2); // audio
  expect(r.i32()).toBe(2);
  expect(r.i32()).toBe(1);
  expect(r.i16()).toBe(0);
  expect(r.i32()).toBe(-1);
  expect(r.i32()).toBe(0);
  expect(r.i32()).toBe(-1);
  expect(r.i32()).toBe(1);
  expect(r.i8()).toBe(2);

  // Out
  expect(r.pstring()).toBe('Out');
  expect(r.i8()).toBe(2);
  expect(r.i32()).toBe(2);
  expect(r.i32()).toBe(0);
  expect(r.i16()).toBe(0);
  // bus=0 constant
  expect(r.i32()).toBe(-1);
  expect(r.i32()).toBe(1);
  // sinosc output 0
  expect(r.i32()).toBe(0);
  expect(r.i32()).toBe(0);

  expect(r.i16()).toBe(0);
  expect(r.position()).toBe(bytes.length);
});

/**
 * Two kr controls → one grouped `Control` UGen with `numOutputs = 2`,
 * `specialIndex = 0` (matches sclang's convention).
 */
test('two kr controls produce one grouped Control UGen', () => {
  const def = new SynthDef('grouped');
  const freq = def.addControl('freq', 440.0, 'control');
  const amp = def.addControl('amp', 0.5, 'control');
  const sin = def.addUgen('SinOsc', 'audio', [freq, k(0)], 1, 0);
  const scaled = def.addUgen(
    'BinaryOpUGen',
    'audio',
    [u(sin), amp],
    1,
    2, // *
  );
  def.addUgen('Out', 'audio', [k(0), u(scaled)], 0, 0);

  const bytes = def.toBytes();

  const r = new Reader(bytes);
  expect(r.i32()).toBe(0x53436766);
  expect(r.i32()).toBe(2);
  expect(r.i16()).toBe(1);
  expect(r.pstring()).toBe('grouped');
  const nconst = r.i32();
  for (let i = 0; i < nconst; i++) r.f32();
  const nparams = r.i32();
  for (let i = 0; i < nparams; i++) r.f32();
  const nnames = r.i32();
  for (let i = 0; i < nnames; i++) {
    r.pstring();
    r.i32();
  }
  const nugens = r.i32();
  expect(nugens).toBe(4); // Control, SinOsc, BinaryOpUGen, Out

  expect(r.pstring()).toBe('Control');
  expect(r.i8()).toBe(1); // control rate
  expect(r.i32()).toBe(0); // no inputs
  expect(r.i32()).toBe(2); // two outputs
  expect(r.i16()).toBe(0); // specialIndex = first param offset
});

/**
 * `toBytes → fromJson → toBytes` is byte-identical to the original.
 * Exercises constants dedup, param encoding, and multi-output refs.
 */
test('SynthDef JSON round-trip preserves bytes', () => {
  const def = new SynthDef('roundtrip');
  const freq = def.addControl('freq', 440.0, 'control');
  const amp = def.addControl('amp', 0.5, 'control');
  const sin = def.addUgen('SinOsc', 'audio', [freq, k(0)], 1, 0);
  const scaled = def.addUgen(
    'BinaryOpUGen',
    'audio',
    [u(sin), amp],
    1,
    2,
  );
  def.addUgen('Out', 'audio', [k(0), u(scaled)], 0, 0);

  const originalBytes = def.toBytes();
  const json = def.toJson();
  const reconstructed = SynthDef.fromJson(json);
  const roundTripBytes = reconstructed.toBytes();

  expect(bytesEqual(originalBytes, roundTripBytes)).toBe(true);
});

/** `toBytes → fromBytes → toBytes` is byte-identical to the original. */
test('SynthDef bytes round-trip preserves bytes', () => {
  const def = new SynthDef('bytes_roundtrip');
  const freq = def.addControl('freq', 220.0, 'control');
  const amp = def.addControl('amp', 0.8, 'control');
  const sin = def.addUgen('SinOsc', 'audio', [freq, k(0)], 1, 0);
  const scaled = def.addUgen(
    'BinaryOpUGen',
    'audio',
    [u(sin), amp],
    1,
    2,
  );
  def.addUgen('Out', 'audio', [k(0), u(scaled)], 0, 0);

  const a = def.toBytes();
  const b = SynthDef.fromBytes(a).toBytes();

  expect(bytesEqual(a, b)).toBe(true);
});

/**
 * Typed UGen builders produce the exact same bytes as the low-level
 * `addUgen` path for an equivalent graph. Exercises the generated
 * `builders/*` classes end-to-end.
 */
test('typed builders match low-level path', () => {
  // Reference: hand-assembled via addUgen.
  const reference = new SynthDef('typed');
  const freqRef = reference.addControl('freq', 440.0, 'control');
  const sinRef = reference.addUgen('SinOsc', 'audio', [freqRef, k(0)], 1, 0);
  reference.addUgen('Out', 'audio', [k(0), u(sinRef)], 0, 0);
  const refBytes = reference.toBytes();

  // Same graph via the generated typed builders.
  const def = new SynthDef('typed');
  const freq = def.addControl('freq', 440.0, 'control');
  const osc = SinOsc.ar().freq(freq).phase(0.0).build(def);
  Out.ar().bus(0.0).channelsArray([osc]).build(def);
  const builtBytes = def.toBytes();

  expect(bytesEqual(refBytes, builtBytes)).toBe(true);
});

/** `SynthDefJson` survives a pass through `JSON.stringify` / `JSON.parse`. */
test('SynthDefJson serializes and parses', () => {
  const def = new SynthDef('json_string');
  const f = def.addControl('freq', 220.0, 'control');
  def.addUgen('SinOsc', 'audio', [f, k(0)], 1, 0);

  const json = def.toJson();
  const s = JSON.stringify(json, null, 2);
  expect(s).toContain('"SinOsc"');
  expect(s).toContain('"freq"');
  // camelCase field names line up with sclang's JSON convention.
  expect(s).toContain('"className"');
  expect(s).toContain('"numInputs"');

  const parsed = JSON.parse(s);
  expect(parsed.name).toBe('json_string');
  expect(parsed.parameters.values).toEqual([220.0]);
});

describe('error cases', () => {
  test('empty name throws', () => {
    const def = new SynthDef('');
    expect(() => def.toBytes()).toThrow();
  });

  test('duplicate control throws', () => {
    const def = new SynthDef('dup');
    def.addControl('freq', 440, 'control');
    expect(() => def.addControl('freq', 220, 'control')).toThrow();
  });

  test('forward reference throws', () => {
    const def = new SynthDef('fwd');
    // Reference a ugen index that doesn't exist yet.
    def.addUgen('Out', 'audio', [k(0), u(99)], 0, 0);
    expect(() => def.toBytes()).toThrow();
  });
});
