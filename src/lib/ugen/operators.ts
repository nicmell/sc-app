import { UGen, type UGenInput, inputRate, maxRate } from './ugen';

// ---------------------------------------------------------------------------
// Binary operator table (specialIndex values for BinaryOpUGen)
// ---------------------------------------------------------------------------

export const binaryOps: Record<string, number> = {
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

// ---------------------------------------------------------------------------
// Unary operator table (specialIndex values for UnaryOpUGen)
// ---------------------------------------------------------------------------

export const unaryOps: Record<string, number> = {
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

// ---------------------------------------------------------------------------
// Constant folding helpers
// ---------------------------------------------------------------------------

function evalBinOp(op: string, a: number, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b !== 0 ? a / b : 0;
    case '%': return b !== 0 ? a % b : 0;
    case 'idiv': return b !== 0 ? Math.trunc(a / b) : 0;
    case 'min': return Math.min(a, b);
    case 'max': return Math.max(a, b);
    case 'pow': return Math.pow(a, b);
    case '==': return a === b ? 1 : 0;
    case '!=': return a !== b ? 1 : 0;
    case '<': return a < b ? 1 : 0;
    case '>': return a > b ? 1 : 0;
    case '<=': return a <= b ? 1 : 0;
    case '>=': return a >= b ? 1 : 0;
    case '&': return a & b;
    case '|': return a | b;
    case '^': return a ^ b;
    case '<<': return a << b;
    case '>>': return a >> b;
    case '>>>': return a >>> b;
    case 'atan2': return Math.atan2(a, b);
    case 'hypot': return Math.hypot(a, b);
    case 'round': return b !== 0 ? Math.round(a / b) * b : 0;
    case 'trunc': return b !== 0 ? Math.trunc(a / b) * b : 0;
    case 'absdif': return Math.abs(a - b);
    default: return NaN;
  }
}

function evalUnaryOp(op: string, a: number): number {
  switch (op) {
    case 'neg': return -a;
    case 'not': return a === 0 ? 1 : 0;
    case 'abs': return Math.abs(a);
    case 'ceil': return Math.ceil(a);
    case 'floor': return Math.floor(a);
    case 'frac': return a - Math.floor(a);
    case 'sign': return Math.sign(a);
    case 'squared': return a * a;
    case 'cubed': return a * a * a;
    case 'sqrt': return Math.sqrt(a);
    case 'exp': return Math.exp(a);
    case 'reciprocal': return a !== 0 ? 1 / a : 0;
    case 'midicps': return 440 * Math.pow(2, (a - 69) / 12);
    case 'cpsmidi': return 69 + 12 * Math.log2(a / 440);
    case 'dbamp': return Math.pow(10, a / 20);
    case 'ampdb': return 20 * Math.log10(a);
    case 'log': return Math.log(a);
    case 'log2': return Math.log2(a);
    case 'log10': return Math.log10(a);
    case 'sin': return Math.sin(a);
    case 'cos': return Math.cos(a);
    case 'tan': return Math.tan(a);
    case 'asin': return Math.asin(a);
    case 'acos': return Math.acos(a);
    case 'atan': return Math.atan(a);
    case 'sinh': return Math.sinh(a);
    case 'cosh': return Math.cosh(a);
    case 'tanh': return Math.tanh(a);
    default: return NaN;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a BinaryOpUGen with constant folding and identity optimizations.
 * Returns a number if both inputs are constants; otherwise returns a UGen.
 */
export function binOp(op: string, a: UGenInput, b: UGenInput): UGenInput {
  const idx = binaryOps[op];
  if (idx === undefined) throw new Error(`Unknown binary operator: ${op}`);

  // Constant folding
  if (typeof a === 'number' && typeof b === 'number') {
    return evalBinOp(op, a, b);
  }

  // Identity / absorbing optimizations
  if (op === '*') {
    if (a === 0 || b === 0) return 0;
    if (a === 1) return b;
    if (b === 1) return a;
  }
  if (op === '+') {
    if (a === 0) return b;
    if (b === 0) return a;
  }
  if (op === '-' && b === 0) return a;
  if (op === '/' && b === 1) return a;

  const rate = maxRate(a, b);
  const ugen = new UGen('BinaryOpUGen', rate, [a, b], 1, idx);
  return ugen;
}

/**
 * Create a UnaryOpUGen with constant folding.
 */
export function unaryOp(op: string, input: UGenInput): UGenInput {
  const idx = unaryOps[op];
  if (idx === undefined) throw new Error(`Unknown unary operator: ${op}`);

  if (typeof input === 'number') {
    return evalUnaryOp(op, input);
  }

  const rate = inputRate(input);
  return new UGen('UnaryOpUGen', rate, [input], 1, idx);
}

/**
 * Optimized multiply-add: `input * mul + add`.
 * Returns a simplified expression when possible.
 */
export function mulAdd(
  input: UGenInput,
  mul: UGenInput = 1,
  add: UGenInput = 0,
): UGenInput {
  if (mul === 0) return add;
  if (mul === 1 && add === 0) return input;
  if (mul === 1) return binOp('+', input, add);
  if (add === 0) return binOp('*', input, mul);

  const rate = maxRate(input, mul, add);
  return new UGen('MulAdd', rate, [input, mul, add], 1);
}
