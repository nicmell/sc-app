// Registry invariants: slice sortedness, presence of common UGens.

import { expect, test } from 'vitest';

import { lookupUgen, ugensByCategory } from '../src/registry.js';

function totalEntries(): number {
  let n = 0;
  for (const [, slice] of ugensByCategory()) n += slice.length;
  return n;
}

test('registry is populated', () => {
  expect(totalEntries()).toBeGreaterThan(300);
});

test('every slice is sorted by name', () => {
  for (const [, slice] of ugensByCategory()) {
    for (let i = 1; i < slice.length; i++) {
      expect(
        slice[i - 1].name < slice[i].name,
        `slice not sorted: ${slice[i - 1].name} >= ${slice[i].name}`,
      ).toBe(true);
    }
  }
});

test('common UGens are present', () => {
  for (const name of ['SinOsc', 'Out', 'BinaryOpUGen', 'RecordBuf', 'Phasor']) {
    expect(lookupUgen(name), `expected ${name} in registry`).not.toBeNull();
  }
});

test('Out has zero outputs', () => {
  const entry = lookupUgen('Out');
  expect(entry).not.toBeNull();
  expect(entry!.numOutputs).toBe(0);
});

test('SinOsc has freq default 440', () => {
  const entry = lookupUgen('SinOsc');
  expect(entry).not.toBeNull();
  const freq = entry!.defaults.find((d) => d.name === 'freq');
  expect(freq?.default).toBe(440.0);
});
