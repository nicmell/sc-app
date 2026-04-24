import { Rate } from '../rate.js';
import { ParsedControl } from './parse-fn.js';

/**
 * Tagged wrapper used to annotate a control's rate inside a destructuring
 * default. The `synthdef(name, fn)` entry point pulls these out of
 * `fn.toString()` and registers each control accordingly.
 *
 *     synthdef('x', (g, { freq = 440, trig = ar(0) }) => …)
 *                            ^ kr (default)    ^ explicit ar
 *
 * `kr(v)` is redundant (plain numbers default to kr), but symmetric.
 * `ir(v)` is the scalar / initialisation-rate form.
 */
export interface ControlWrapper {
  readonly __scControl: true;
  readonly rate: Rate;
  readonly value: number;
}

function make(rate: Rate, value: number): ControlWrapper {
  return { __scControl: true, rate, value };
}

export function ar(v: number): ControlWrapper {
  return make('audio', v);
}

export function kr(v: number): ControlWrapper {
  return make('control', v);
}

export function ir(v: number): ControlWrapper {
  return make('scalar', v);
}

function isControlWrapper(v: unknown): v is ControlWrapper {
  return (
    typeof v === 'object' &&
    v !== null &&
    (v as { __scControl?: unknown }).__scControl === true
  );
}

export interface ResolvedControl {
  name: string;
  rate: Rate;
  defaultValue: number;
}

/**
 * Evaluate each parsed control's default expression in an isolated scope
 * that exposes only `ar` / `kr` / `ir`. Plain numeric literals become
 * control-rate (kr) controls; `ar(v)` / `ir(v)` / `kr(v)` wrappers
 * override the rate.
 *
 * Limitation: expressions that reference outer bindings (imported
 * constants, captured variables) will fail with a ReferenceError. This
 * is deliberate — the parser only evaluates expression text, not the
 * callback's closure. Workaround: inline the value, or declare it as a
 * plain literal in the default.
 */
export function resolveControls(parsed: ParsedControl[]): ResolvedControl[] {
  return parsed.map((p) => resolveOne(p));
}

/**
 * Recognise `ar(N)` / `kr(N)` / `ir(N)` calls — optionally qualified
 * with a single-level member access, which is how bundlers like Vite's
 * SSR transform rewrite ESM named imports (e.g.
 * `__vite_ssr_import_0__.ar(0)`). Anything beyond this shape is handled
 * by the fallback `new Function` evaluator.
 */
const RATE_CALL_RE = /^(?:[A-Za-z_$][\w$]*\s*\.\s*)?(ar|kr|ir)\s*\(\s*([-+0-9.eE]+)\s*\)$/;

/** Plain numeric literal — integer or decimal, optional sign / exponent. */
const NUMBER_RE = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?$/;

function resolveOne(p: ParsedControl): ResolvedControl {
  if (p.defaultExpr.length === 0) {
    throw new Error(
      `synthdef: control "${p.name}" has no default value — each control ` +
        `must be written as \`${p.name} = <number>\` or \`${p.name} = ar|kr|ir(<number>)\``,
    );
  }

  // Fast paths for the shapes users actually write — these bypass
  // `new Function`, which in turn avoids bundler-rewritten identifiers
  // in test/SSR environments (Vite rewrites `ar` → `__vite_ssr_import_X__.ar`).
  const rateMatch = RATE_CALL_RE.exec(p.defaultExpr);
  if (rateMatch) {
    const [, rateName, numStr] = rateMatch;
    const n = Number(numStr);
    if (!Number.isFinite(n)) {
      throw new Error(
        `synthdef: control "${p.name}" default ${p.defaultExpr} has a non-finite argument`,
      );
    }
    const rate = rateName === 'ar' ? 'audio' : rateName === 'ir' ? 'scalar' : 'control';
    return { name: p.name, rate, defaultValue: n };
  }
  if (NUMBER_RE.test(p.defaultExpr)) {
    return { name: p.name, rate: 'control', defaultValue: Number(p.defaultExpr) };
  }

  // Fallback: evaluate in an isolated scope with only ar/kr/ir bound.
  // Works for plain ESM callers; fails predictably when the default
  // references outer bindings.
  let evaluated: unknown;
  try {
    const fn = new Function('ar', 'kr', 'ir', `"use strict"; return (${p.defaultExpr});`);
    evaluated = fn(ar, kr, ir);
  } catch (e) {
    throw new Error(
      `synthdef: could not evaluate default for control "${p.name}": ` +
        `${p.defaultExpr} — ${(e as Error).message}. Defaults must be ` +
        `literal numbers or ar()/kr()/ir() wrappers; outer references are not supported.`,
    );
  }
  if (isControlWrapper(evaluated)) {
    return { name: p.name, rate: evaluated.rate, defaultValue: evaluated.value };
  }
  if (typeof evaluated === 'number' && Number.isFinite(evaluated)) {
    return { name: p.name, rate: 'control', defaultValue: evaluated };
  }
  throw new Error(
    `synthdef: default for control "${p.name}" must evaluate to a number or ` +
      `an ar()/kr()/ir() wrapper — got: ${String(evaluated)}`,
  );
}
