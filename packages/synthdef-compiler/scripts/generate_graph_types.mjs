#!/usr/bin/env node
// Generate src/sugar/graph.types.ts from the registry. Gives the `Graph`
// interface full per-UGen typing: every call becomes
// `g.Name.ar(arg1?, arg2?, …)` with positional parameters named after
// the registry's arg list, each typed `UGenInputLike` (or `number` for
// `numChannels` args, `UGenInputLike | UGenInputLike[]` for variadic
// `channelsArray` / `inputArray`).
//
// Args with registry defaults are typed `arg?: …` (optional); args
// without defaults remain required. This mirrors the semantics that
// `makeGraph()` uses at runtime.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const SPECS_DIR = join(PKG_ROOT, 'src', 'specs');
const OUT = join(PKG_ROOT, 'src', 'sugar', 'graph.types.ts');

const VARIADIC_ARGS = new Set(['channelsArray', 'inputArray']);
const NUM_OUTPUTS_ARGS = new Set(['numChannels']);

// Reserved TS identifiers that can't be used as plain parameter names.
const TS_RESERVED = new Set([
  'arguments',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

function safeParam(name) {
  return TS_RESERVED.has(name) ? `${name}_` : name;
}

/** Load every generated spec file without evaluating (avoids TS type deps). */
function loadAllEntries() {
  const files = readdirSync(SPECS_DIR).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  const entries = [];
  for (const f of files) {
    const src = readFileSync(join(SPECS_DIR, f), 'utf8');
    entries.push(...parseSpecFile(src));
  }
  // Sort by UGen name for stable output.
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return entries;
}

/**
 * Parse a generated specs/*.ts file into plain JS objects. The generator
 * emits these files in a very regular shape so a straight-forward
 * regex/eval-style parser works — no TS compiler needed.
 */
function parseSpecFile(src) {
  // Find the UGENS array start and iterate its top-level `{ … }` blocks.
  const marker = 'export const UGENS: UGenRegistryEntry[] = [';
  const start = src.indexOf(marker);
  if (start < 0) return [];
  let i = start + marker.length;
  const entries = [];
  while (i < src.length) {
    // Skip whitespace.
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] === ']') break;
    if (src[i] !== '{') {
      i++;
      continue;
    }
    // Find the matching `}` respecting string literals.
    const bodyStart = i + 1;
    let depth = 1;
    let j = bodyStart;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === '"' || c === "'" || c === '`') {
        j = skipString(src, j);
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    const body = src.slice(bodyStart, j);
    entries.push(parseEntryBody(body));
    i = j + 1;
    // Skip a trailing comma if present.
    while (i < src.length && /[\s,]/.test(src[i])) i++;
  }
  return entries;
}

function skipString(src, i) {
  const q = src[i];
  let j = i + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === q) return j + 1;
    j++;
  }
  return src.length;
}

function parseEntryBody(body) {
  // Fields we care about: name (string), rates (array of string), defaults
  // (array of { name: string; default: number | null }). Others ignored.
  const name = matchString(body, /name:\s*"([^"]+)"/);
  const ratesStr = matchRaw(body, /rates:\s*\[([^\]]*)\]/);
  const rates = ratesStr
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.slice(1, -1)); // drop surrounding quotes

  const defaultsBlock = matchRaw(body, /defaults:\s*\[([\s\S]*?)\],\s*numOutputs/);
  const defaults = [];
  const re = /\{\s*name:\s*"([^"]+)",\s*default:\s*(null|-?\d+(?:\.\d+)?(?:e-?\d+)?)\s*\},?/g;
  let m;
  while ((m = re.exec(defaultsBlock)) !== null) {
    defaults.push({
      name: m[1],
      default: m[2] === 'null' ? null : Number(m[2]),
    });
  }
  return { name, rates, defaults };
}

function matchString(src, re) {
  const m = re.exec(src);
  if (!m) throw new Error(`missing match for ${re}`);
  return m[1];
}

function matchRaw(src, re) {
  const m = re.exec(src);
  if (!m) throw new Error(`missing match for ${re}`);
  return m[1];
}

/** Classify an arg for type emission. */
function argKind(argName) {
  if (NUM_OUTPUTS_ARGS.has(argName)) return 'numOutputs';
  if (VARIADIC_ARGS.has(argName)) return 'variadic';
  return 'input';
}

/** Turn a registry arg into a TS parameter declaration. */
function emitParam(arg, forceOptional) {
  const kind = argKind(arg.name);
  const optional = forceOptional || arg.default !== null;
  const name = safeParam(arg.name) + (optional ? '?' : '');
  const type =
    kind === 'numOutputs'
      ? 'number'
      : kind === 'variadic'
        ? 'UGenInputLike | UGenInputLike[]'
        : 'UGenInputLike';
  return `${name}: ${type}`;
}

function emitUgenInterface(entry) {
  // TS requires optional params to precede required ones. A handful of
  // registry entries have `default: null` args (required) after
  // defaulted ones (optional) — once we've seen any optional arg, mark
  // every subsequent arg optional too to keep the signature valid. The
  // runtime still throws on a missing required arg.
  let seenOptional = false;
  const paramStrs = [];
  for (const a of entry.defaults) {
    const hasDefault = a.default !== null;
    const optional = seenOptional || hasDefault;
    paramStrs.push(emitParam(a, optional));
    if (hasDefault) seenOptional = true;
  }
  const params = paramStrs.join(', ');
  const rateLines = entry.rates.map((r) => {
    const method = r === 'audio' ? 'ar' : r === 'control' ? 'kr' : 'ir';
    return `    ${method}(${params}): UGenInput;`;
  });
  return [`  readonly ${entry.name}: {`, ...rateLines, '  };'].join('\n');
}

function main() {
  const entries = loadAllEntries();

  const lines = [];
  lines.push('// @generated — DO NOT EDIT. Regenerate with scripts/generate_graph_types.mjs.');
  lines.push('//');
  lines.push('// Typed shape of the `g` namespace passed into `synthdef(name, fn)`');
  lines.push('// callbacks. One entry per bundled UGen, plus arithmetic/math operator');
  lines.push('// helpers on the root. Positional arguments follow each UGen\'s');
  lines.push('// registry order; args with defaults are optional.');
  lines.push('');
  lines.push("import type { UGenInput, UGenInputLike } from '../ugen-input.js';");
  lines.push('');
  lines.push('export interface GraphOperators {');
  lines.push('  /** `a * b` — BinaryOpUGen (specialIndex 2). */');
  lines.push('  readonly mul: (a: UGenInputLike, b: UGenInputLike) => UGenInput;');
  lines.push('  /** `a + b` — BinaryOpUGen (specialIndex 0). */');
  lines.push('  readonly add: (a: UGenInputLike, b: UGenInputLike) => UGenInput;');
  lines.push('  /** `a - b` — BinaryOpUGen (specialIndex 1). */');
  lines.push('  readonly sub: (a: UGenInputLike, b: UGenInputLike) => UGenInput;');
  lines.push('  /** `a / b` — BinaryOpUGen (specialIndex 4). */');
  lines.push('  readonly div: (a: UGenInputLike, b: UGenInputLike) => UGenInput;');
  lines.push('  /** `a % b` — BinaryOpUGen (specialIndex 5). */');
  lines.push('  readonly mod: (a: UGenInputLike, b: UGenInputLike) => UGenInput;');
  lines.push('  /** `a ** b` — BinaryOpUGen (specialIndex 25). */');
  lines.push('  readonly pow: (a: UGenInputLike, b: UGenInputLike) => UGenInput;');
  lines.push('  /** Element-wise minimum. */');
  lines.push('  readonly min: (a: UGenInputLike, b: UGenInputLike) => UGenInput;');
  lines.push('  /** Element-wise maximum. */');
  lines.push('  readonly max: (a: UGenInputLike, b: UGenInputLike) => UGenInput;');
  lines.push('  /** `-a` — UnaryOpUGen (specialIndex 0). */');
  lines.push('  readonly neg: (a: UGenInputLike) => UGenInput;');
  lines.push('  /** `|a|` — UnaryOpUGen (specialIndex 5). */');
  lines.push('  readonly abs: (a: UGenInputLike) => UGenInput;');
  lines.push('  /** `1 / a` — UnaryOpUGen. */');
  lines.push('  readonly reciprocal: (a: UGenInputLike) => UGenInput;');
  lines.push('  /** MIDI note → frequency. */');
  lines.push('  readonly midicps: (a: UGenInputLike) => UGenInput;');
  lines.push('  /** Frequency → MIDI note. */');
  lines.push('  readonly cpsmidi: (a: UGenInputLike) => UGenInput;');
  lines.push('  /** Amplitude → decibels. */');
  lines.push('  readonly ampdb: (a: UGenInputLike) => UGenInput;');
  lines.push('  /** Decibels → amplitude. */');
  lines.push('  readonly dbamp: (a: UGenInputLike) => UGenInput;');
  lines.push('}');
  lines.push('');
  lines.push('export interface GraphUGens {');
  for (const entry of entries) {
    lines.push(emitUgenInterface(entry));
  }
  lines.push('}');
  lines.push('');
  lines.push('export type Graph = GraphUGens & GraphOperators;');
  lines.push('');

  writeFileSync(OUT, lines.join('\n'));
  console.log(`generated ${entries.length} UGen type signatures → ${OUT}`);
}

main();
