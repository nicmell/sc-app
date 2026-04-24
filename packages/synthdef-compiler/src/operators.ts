/**
 * Binary/unary operator tables for BinaryOpUGen and UnaryOpUGen.
 *
 * Values are the `specialIndex` slot scsynth uses to dispatch to the
 * correct operator implementation.
 */

const BINARY_OPS: Record<string, number> = {
  '+': 0,
  '-': 1,
  '*': 2,
  idiv: 3,
  '/': 4,
  '%': 5,
  '==': 6,
  '!=': 7,
  '<': 8,
  '>': 9,
  '<=': 10,
  '>=': 11,
  min: 12,
  max: 13,
  '&': 14,
  '|': 15,
  '^': 16,
  lcm: 17,
  gcd: 18,
  round: 19,
  roundUp: 20,
  trunc: 21,
  atan2: 22,
  hypot: 23,
  pow: 25,
  '<<': 26,
  '>>': 27,
  '>>>': 28,
  ring1: 30,
  ring2: 31,
  ring3: 32,
  ring4: 33,
  difsqr: 34,
  sumsqr: 35,
  sqrsum: 36,
  sqrdif: 37,
  absdif: 38,
  clip2: 42,
  fold2: 44,
  wrap2: 45,
};

const UNARY_OPS: Record<string, number> = {
  neg: 0,
  not: 1,
  bitNot: 4,
  abs: 5,
  ceil: 8,
  floor: 9,
  frac: 10,
  sign: 11,
  squared: 12,
  cubed: 13,
  sqrt: 14,
  exp: 15,
  reciprocal: 16,
  midicps: 17,
  cpsmidi: 18,
  midiratio: 19,
  ratiomidi: 20,
  dbamp: 21,
  ampdb: 22,
  octcps: 23,
  cpsoct: 24,
  log: 25,
  log2: 26,
  log10: 27,
  sin: 28,
  cos: 29,
  tan: 30,
  asin: 31,
  acos: 32,
  atan: 33,
  sinh: 34,
  cosh: 35,
  tanh: 36,
  distort: 42,
  softclip: 43,
};

/**
 * Look up the `specialIndex` for a binary operator name (e.g. `+`, `-`, `*`,
 * `min`, `max`, `pow`). Returns `null` for unknown operators.
 */
export function binaryOpIndex(op: string): number | null {
  return op in BINARY_OPS ? BINARY_OPS[op] : null;
}

/**
 * Look up the `specialIndex` for a unary operator name (e.g. `neg`, `abs`,
 * `sin`, `midicps`). Returns `null` for unknown operators.
 */
export function unaryOpIndex(op: string): number | null {
  return op in UNARY_OPS ? UNARY_OPS[op] : null;
}
