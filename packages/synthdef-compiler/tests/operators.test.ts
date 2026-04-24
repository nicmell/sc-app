// BinaryOpUGen / UnaryOpUGen special-index lookups.

import { expect, test } from 'vitest';

import { binaryOpIndex, unaryOpIndex } from '../src/operators.js';

test('binary ops cover expected', () => {
  expect(binaryOpIndex('+')).toBe(0);
  expect(binaryOpIndex('*')).toBe(2);
  expect(binaryOpIndex('pow')).toBe(25);
  expect(binaryOpIndex('wrap2')).toBe(45);
  expect(binaryOpIndex('nope')).toBe(null);
});

test('unary ops cover expected', () => {
  expect(unaryOpIndex('neg')).toBe(0);
  expect(unaryOpIndex('midicps')).toBe(17);
  expect(unaryOpIndex('softclip')).toBe(43);
  expect(unaryOpIndex('nope')).toBe(null);
});
