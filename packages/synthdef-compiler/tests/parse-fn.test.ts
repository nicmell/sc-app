import { expect, test } from 'vitest';

import { parseCallback } from '../src/sugar/parse-fn.js';

test('non-destructured second parameter is rejected', () => {
  const fn = (_g: unknown, _c: Record<string, unknown>) => {};
  expect(() => parseCallback(fn)).toThrow(/destructuring pattern/);
});

test('single-arg callback has no controls', () => {
  const fn = (_g: unknown) => {};
  const parsed = parseCallback(fn);
  expect(parsed.hasControlsParam).toBe(false);
  expect(parsed.controls).toEqual([]);
});

test('destructured defaults', () => {
  const fn = (_g: unknown, { freq = 440, amp = 0.5 }: Record<string, number>) => {
    void freq;
    void amp;
  };
  const parsed = parseCallback(fn);
  expect(parsed.hasControlsParam).toBe(true);
  expect(parsed.controls).toHaveLength(2);
  expect(parsed.controls[0].name).toBe('freq');
  expect(parsed.controls[0].defaultExpr).toBe('440');
  expect(parsed.controls[1].name).toBe('amp');
  expect(parsed.controls[1].defaultExpr).toBe('0.5');
});

test('rate wrapper in default', () => {
  // The wrapper is kept as raw expression text; evaluation happens later.
  const fn = (
    _g: unknown,
    // @ts-expect-error — ar is defined at test-eval time, not here.
    { trig = ar(0), seed = ir(42) }: Record<string, number>,
  ) => {
    void trig;
    void seed;
  };
  const parsed = parseCallback(fn);
  expect(parsed.controls[0].defaultExpr).toBe('ar(0)');
  expect(parsed.controls[1].defaultExpr).toBe('ir(42)');
});

test('rejects rest elements', () => {
  const fn = (_g: unknown, { a = 1, ...rest }: Record<string, number>) => {
    void a;
    void rest;
  };
  expect(() => parseCallback(fn)).toThrow(/rest/);
});

test('accepts aliased destructuring — control name is the property key', () => {
  // The aliased form arises from bundler/SSR rewrites of shadowed names.
  // The control should be named by the property key ("a"), not the alias.
  const fn = (_g: unknown, { a: b = 1 }: Record<string, number>) => {
    void b;
  };
  const parsed = parseCallback(fn);
  expect(parsed.controls).toEqual([{ name: 'a', defaultExpr: '1' }]);
});

test('tolerates outer = {} default', () => {
  const fn = (_g: unknown, { freq = 440 }: Record<string, number> = {}) => {
    void freq;
  };
  const parsed = parseCallback(fn);
  expect(parsed.controls).toEqual([{ name: 'freq', defaultExpr: '440' }]);
});
