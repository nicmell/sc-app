/**
 * Phase 25c — REPL shorthand parser.
 *
 * Whitespace-separated tokens. The first bare token (no `:`) becomes
 * the `s` (sample) value; everything else is a `key:value` pair.
 * Numeric values are parsed if they match the strict signed-decimal
 * regex; otherwise the value stays a string. Duplicate keys throw.
 *
 *   bd                          → { s: 'bd' }
 *   bd cutoff:800               → { s: 'bd', cutoff: 800 }
 *   bd cutoff:800 amp:0.5 n:2   → { s: 'bd', cutoff: 800, amp: 0.5, n: 2 }
 *   vowel:a room:0.4            → { vowel: 'a', room: 0.4 }
 *
 * The numeric regex is deliberately strict — `1abc` stays a string
 * (`parseFloat` would silently coerce to `1`). osc-js will pick
 * int32 vs float32 based on whole-number-ness, matching SuperDirt's
 * conventions on the wire.
 */

import { DirtParseError, type DirtArg, type DirtEventInput } from './types';

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

export function parseDirtRepl(input: string): DirtEventInput {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    throw new DirtParseError('empty input');
  }

  const tokens = trimmed.split(/\s+/);
  const event: DirtEventInput = {};

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    const colonIdx = tok.indexOf(':');

    // First bare token (no `:`) is shorthand for `s`. After the
    // first slot, every token must be a key:value pair — we don't
    // accept a second bare token because it's almost always a typo.
    if (colonIdx < 0) {
      if (i !== 0) {
        throw new DirtParseError(
          `bare token ${JSON.stringify(tok)} at position ${i + 1} — only the first token may omit \`key:\``,
        );
      }
      event.s = tok;
      continue;
    }

    if (colonIdx === 0) {
      throw new DirtParseError(`empty key in ${JSON.stringify(tok)}`);
    }

    const key = tok.slice(0, colonIdx);
    const valueStr = tok.slice(colonIdx + 1);

    if (valueStr.length === 0) {
      throw new DirtParseError(`empty value for key ${JSON.stringify(key)}`);
    }
    if (Object.prototype.hasOwnProperty.call(event, key)) {
      throw new DirtParseError(`duplicate key ${JSON.stringify(key)}`);
    }

    event[key] = parseValue(valueStr);
  }

  return event;
}

function parseValue(s: string): DirtArg {
  if (NUMERIC_RE.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) return n;
  }
  return s;
}
