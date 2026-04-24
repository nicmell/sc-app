// Shared helpers used by generate_specs.mjs and generate_builders.mjs.
// Parses the narrow subset of Rust value syntax that the generated specs
// / builders files contain. Not a general Rust parser.

/**
 * Split a top-level comma-separated list, ignoring commas inside balanced
 * `(`/`[`/`{` pairs and inside `r"..."` / `r#"..."#` raw strings.
 */
export function splitTopLevelCommas(s) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === 'r' && (s[i + 1] === '"' || s[i + 1] === '#')) {
      const end = findRawStringEnd(s, i);
      i = end - 1;
      continue;
    }
    if (c === '(' || c === '[' || c === '{' || c === '<') depth++;
    else if (c === ')' || c === ']' || c === '}' || c === '>') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts.filter((p) => p.trim().length > 0);
}

/**
 * Given `s` and `i` pointing at the `r` of `r"..."` or `r#"..."#`,
 * return the index one past the closing quote (+ matching `#`s).
 * Throws on malformed input.
 */
export function findRawStringEnd(s, i) {
  if (s[i] !== 'r') throw new Error(`expected r at ${i}`);
  let j = i + 1;
  let hashes = 0;
  while (s[j] === '#') {
    hashes++;
    j++;
  }
  if (s[j] !== '"') throw new Error(`expected " at ${j}`);
  j++;
  // Scan forward for the closing `"` followed by `hashes` `#`s.
  while (j < s.length) {
    if (s[j] === '"') {
      let k = 0;
      while (k < hashes && s[j + 1 + k] === '#') k++;
      if (k === hashes) return j + 1 + hashes;
    }
    j++;
  }
  throw new Error(`unterminated raw string starting at ${i}`);
}

/**
 * Parse a single raw-string literal starting at `i` (index of `r`). Return
 * `{ value, end }` where `value` is the unescaped literal content (raw
 * strings have no escape processing) and `end` is the index one past the
 * closing quote.
 */
export function parseRawString(s, i) {
  if (s[i] !== 'r') throw new Error(`expected r at ${i}`);
  let j = i + 1;
  let hashes = 0;
  while (s[j] === '#') {
    hashes++;
    j++;
  }
  if (s[j] !== '"') throw new Error(`expected " at ${j}`);
  const contentStart = j + 1;
  j = contentStart;
  while (j < s.length) {
    if (s[j] === '"') {
      let k = 0;
      while (k < hashes && s[j + 1 + k] === '#') k++;
      if (k === hashes) {
        return { value: s.slice(contentStart, j), end: j + 1 + hashes };
      }
    }
    j++;
  }
  throw new Error(`unterminated raw string starting at ${i}`);
}

/**
 * Parse `Some(...)` / `None`. Return `{ value, end }` where value is the
 * raw Rust expression inside `Some(...)` or `null` for None.
 */
export function parseOption(s, i) {
  // Skip whitespace.
  while (s[i] === ' ' || s[i] === '\t' || s[i] === '\n') i++;
  if (s.startsWith('None', i)) return { value: null, end: i + 4 };
  if (!s.startsWith('Some(', i)) {
    throw new Error(`expected Some(...) or None at ${i}: ${s.slice(i, i + 20)}`);
  }
  let j = i + 5;
  let depth = 1;
  while (j < s.length && depth > 0) {
    const c = s[j];
    if (c === 'r' && (s[j + 1] === '"' || s[j + 1] === '#')) {
      j = findRawStringEnd(s, j);
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    if (depth === 0) break;
    j++;
  }
  if (depth !== 0) throw new Error(`unterminated Some(...) at ${i}`);
  const inner = s.slice(i + 5, j).trim();
  return { value: inner, end: j + 1 };
}

/**
 * Extract all top-level `UGenRegistryEntry { ... }` blocks from spec source.
 * Returns an array of block-body strings (contents between the outer `{ }`).
 */
export function extractRegistryEntries(src) {
  const entries = [];
  const marker = 'UGenRegistryEntry';
  let i = 0;
  while ((i = src.indexOf(marker, i)) !== -1) {
    let j = i + marker.length;
    // Skip whitespace to the opening `{`.
    while (j < src.length && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n')) j++;
    if (src[j] !== '{') {
      i = j;
      continue;
    }
    const bodyStart = j + 1;
    let depth = 1;
    j = bodyStart;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === 'r' && (src[j + 1] === '"' || src[j + 1] === '#')) {
        j = findRawStringEnd(src, j);
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    if (depth !== 0) throw new Error(`unterminated UGenRegistryEntry at ${i}`);
    entries.push(src.slice(bodyStart, j));
    i = j + 1;
  }
  return entries;
}

/**
 * Given a registry entry body, split it into `{ key: valueStr }` pairs.
 * Keys are simple idents. Values are raw Rust expression strings.
 */
export function parseEntryFields(body) {
  // Split top-level commas — handling nested brackets and raw strings.
  const parts = splitTopLevelCommas(body);
  const fields = {};
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const m = p.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*/);
    if (!m) throw new Error(`unparseable field: ${p.slice(0, 80)}`);
    const key = m[1];
    const valueStr = p.slice(m[0].length).trim();
    fields[key] = valueStr;
  }
  return fields;
}

/**
 * Parse a Rust slice literal: `&[elem, elem, ...]` → array of element
 * expression strings. Handles nested `r"..."` and balanced brackets.
 */
export function parseSlice(expr) {
  const e = expr.trim();
  if (!e.startsWith('&[')) throw new Error(`expected &[...] got ${e.slice(0, 40)}`);
  if (!e.endsWith(']')) throw new Error(`unterminated slice: ${e.slice(0, 40)}`);
  const body = e.slice(2, -1);
  return splitTopLevelCommas(body).map((p) => p.trim());
}

/**
 * Parse a Rust tuple literal: `(a, b, c)` → array of element expression
 * strings.
 */
export function parseTuple(expr) {
  const e = expr.trim();
  if (!e.startsWith('(') || !e.endsWith(')')) {
    throw new Error(`expected (...) got ${e.slice(0, 40)}`);
  }
  return splitTopLevelCommas(e.slice(1, -1)).map((p) => p.trim());
}

/**
 * Parse a Rust raw-string expression (the whole expr is `r"..."` or
 * `r#"..."#`). Returns the unescaped string content.
 */
export function parseRawStringExpr(expr) {
  const e = expr.trim();
  const { value } = parseRawString(e, 0);
  return value;
}

/**
 * Parse an `Option<T>` expression into either `null` or the value string
 * (un-extracted, caller parses further).
 */
export function parseOptionExpr(expr) {
  const e = expr.trim();
  if (e === 'None') return null;
  if (!e.startsWith('Some(') || !e.endsWith(')')) {
    throw new Error(`expected Some(..) or None: ${e.slice(0, 60)}`);
  }
  return e.slice(5, -1).trim();
}

/** Parse a float literal (e.g. `440.0`, `-1.5`, `0.0`). */
export function parseFloatExpr(expr) {
  const e = expr.trim().replace(/f32$/, '').replace(/f64$/, '');
  const n = Number(e);
  if (!Number.isFinite(n)) throw new Error(`bad float: ${expr}`);
  return n;
}

/** Parse a u32 literal (e.g. `2`, `42u32`). */
export function parseU32Expr(expr) {
  const e = expr.trim().replace(/u32$/, '').replace(/i32$/, '');
  const n = Number(e);
  if (!Number.isInteger(n)) throw new Error(`bad u32: ${expr}`);
  return n;
}

/**
 * Escape a string for inclusion as a TS string literal (double-quoted).
 * Backslash, double-quote, newline, carriage return, tab.
 */
export function tsString(s) {
  return (
    '"' +
    s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
    '"'
  );
}

export const RATE_RUST_TO_TS = {
  'Rate::Audio': "'audio'",
  'Rate::Control': "'control'",
  'Rate::Scalar': "'scalar'",
};
