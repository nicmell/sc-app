#!/usr/bin/env node
// Parse crates/scsynthdef-compiler/src/specs/*.rs and emit matching
// TypeScript specs under packages/synthdef-compiler/src/specs/*.ts.
//
// One TS file per Rust source, plus an index.ts that exports `ALL_SLICES`
// (parallel to the Rust `specs::ALL_SLICES`). Each file exports
// `UGENS: UGenRegistryEntry[]` sorted by UGen name.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  extractRegistryEntries,
  parseEntryFields,
  parseSlice,
  parseTuple,
  parseRawStringExpr,
  parseOptionExpr,
  parseFloatExpr,
  parseU32Expr,
  tsString,
  RATE_RUST_TO_TS,
} from './rust_parse.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const CRATE_ROOT = join(PKG_ROOT, '..', '..', 'crates', 'scsynthdef-compiler');
const RUST_SPECS_DIR = join(CRATE_ROOT, 'src', 'specs');
const TS_SPECS_DIR = join(PKG_ROOT, 'src', 'specs');

// ── Parse a single registry entry into a JS object ─────────────────────────
function parseRegistryEntry(body) {
  const fields = parseEntryFields(body);

  const name = parseRawStringExpr(fields.name);

  const ratesSlice = parseSlice(fields.rates);
  const rates = ratesSlice.map((r) => {
    const ts = RATE_RUST_TO_TS[r];
    if (!ts) throw new Error(`unknown rate: ${r}`);
    return ts;
  });

  const defaultsSlice = parseSlice(fields.defaults);
  const defaults = defaultsSlice.map((tup) => {
    const [nameExpr, defExpr] = parseTuple(tup);
    const argName = parseRawStringExpr(nameExpr);
    const defValueExpr = parseOptionExpr(defExpr);
    const defValue = defValueExpr === null ? null : parseFloatExpr(defValueExpr);
    return { name: argName, default: defValue };
  });

  const numOutputsExpr = parseOptionExpr(fields.num_outputs);
  const numOutputs = numOutputsExpr === null ? null : parseU32Expr(numOutputsExpr);

  const extendsExpr = parseOptionExpr(fields.extends);
  const extendsVal = extendsExpr === null ? null : parseRawStringExpr(extendsExpr);

  const summaryExpr = parseOptionExpr(fields.summary);
  const summary = summaryExpr === null ? null : parseRawStringExpr(summaryExpr);

  const docExpr = parseOptionExpr(fields.doc);
  const doc = docExpr === null ? null : parseRawStringExpr(docExpr);

  const signalRangeExpr = parseOptionExpr(fields.signal_range);
  const signalRange = signalRangeExpr === null ? null : parseRawStringExpr(signalRangeExpr);

  const argDocsSlice = parseSlice(fields.arg_docs);
  const argDocs = argDocsSlice.map((tup) => {
    const [nameExpr, docExprT] = parseTuple(tup);
    return {
      name: parseRawStringExpr(nameExpr),
      doc: parseRawStringExpr(docExprT),
    };
  });

  return {
    name,
    rates,
    defaults,
    numOutputs,
    extends: extendsVal,
    summary,
    doc,
    signalRange,
    argDocs,
  };
}

// ── Emit a single TS specs file ────────────────────────────────────────────
function emitSpecFile(category, entries) {
  const lines = [];
  lines.push('// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.');
  lines.push('//');
  lines.push('// Ported from crates/scsynthdef-compiler/src/specs/' + category + '.rs.');
  lines.push('');
  lines.push("import { UGenRegistryEntry } from '../registry.js';");
  lines.push('');
  lines.push('export const UGENS: UGenRegistryEntry[] = [');
  for (const e of entries) {
    lines.push('  {');
    lines.push(`    name: ${tsString(e.name)},`);
    lines.push(`    rates: [${e.rates.join(', ')}],`);
    lines.push(`    defaults: [`);
    for (const d of e.defaults) {
      const defStr = d.default === null ? 'null' : formatF32TS(d.default);
      lines.push(`      { name: ${tsString(d.name)}, default: ${defStr} },`);
    }
    lines.push(`    ],`);
    lines.push(`    numOutputs: ${e.numOutputs === null ? 'null' : e.numOutputs},`);
    lines.push(`    extends: ${e.extends === null ? 'null' : tsString(e.extends)},`);
    lines.push(`    summary: ${e.summary === null ? 'null' : tsString(e.summary)},`);
    lines.push(`    doc: ${e.doc === null ? 'null' : tsString(e.doc)},`);
    lines.push(
      `    signalRange: ${e.signalRange === null ? 'null' : tsString(e.signalRange)},`,
    );
    lines.push(`    argDocs: [`);
    for (const ad of e.argDocs) {
      lines.push(`      { name: ${tsString(ad.name)}, doc: ${tsString(ad.doc)} },`);
    }
    lines.push(`    ],`);
    lines.push('  },');
  }
  lines.push('];');
  lines.push('');
  return lines.join('\n');
}

// TS has no f32, so we round-trip through a Float32Array to collapse
// doubles to their f32 representation (matches the Rust side). Emit a
// number literal that reconstructs exactly on parse.
const SHARED_F32 = new Float32Array(1);
function formatF32TS(n) {
  SHARED_F32[0] = n;
  const v = SHARED_F32[0];
  if (Number.isInteger(v)) return `${v}`;
  // Use the default JS string form — it's the shortest round-trippable.
  return `${v}`;
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  const files = readdirSync(RUST_SPECS_DIR)
    .filter((f) => f.endsWith('.rs') && f !== 'mod.rs')
    .sort();

  const categories = [];
  for (const f of files) {
    const category = f.replace(/\.rs$/, '');
    const src = readFileSync(join(RUST_SPECS_DIR, f), 'utf8');
    const entries = extractRegistryEntries(src).map(parseRegistryEntry);
    // Codepoint-wise sort matches Rust's `str::cmp` byte-wise ordering.
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    const ts = emitSpecFile(category, entries);
    writeFileSync(join(TS_SPECS_DIR, `${category}.ts`), ts);
    categories.push(category);
  }

  // Emit the index.ts with the category list (sorted by category name to
  // match the Rust `specs::ALL_SLICES` order).
  const idxLines = [];
  idxLines.push('// @generated — DO NOT EDIT. Regenerate with scripts/generate_specs.mjs.');
  idxLines.push('');
  idxLines.push("import { UGenRegistryEntry } from '../registry.js';");
  for (const c of categories) {
    idxLines.push(`import { UGENS as ${camelCase(c)}Ugens } from './${c}.js';`);
  }
  idxLines.push('');
  idxLines.push('export const ALL_SLICES: [string, UGenRegistryEntry[]][] = [');
  for (const c of categories) {
    idxLines.push(`  [${tsString(c)}, ${camelCase(c)}Ugens],`);
  }
  idxLines.push('];');
  idxLines.push('');
  writeFileSync(join(TS_SPECS_DIR, 'index.ts'), idxLines.join('\n'));

  const total = categories.reduce((acc, c) => {
    const src = readFileSync(join(RUST_SPECS_DIR, `${c}.rs`), 'utf8');
    return acc + extractRegistryEntries(src).length;
  }, 0);
  console.log(`generated ${categories.length} spec files, ${total} UGens total`);
}

function camelCase(snake) {
  return snake.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

main();
