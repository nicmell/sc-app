#!/usr/bin/env node

// Reads src/assets/ugens/*.json (curated source of truth) and regenerates
// crates/scsynthdef-compiler/src/ugens/: one Rust module per JSON file,
// each exposing a `pub(crate) const UGENS: &[UGenRegistryEntry]` slice, plus
// a mod.rs that aggregates them into `ALL_SLICES`.
//
// The Overtone fetcher lives in `generate_ugen_db.mjs` — run that only when
// refreshing metadata from upstream. This script is the routine workflow for
// picking up any hand edit to src/assets/ugens/*.json.
//
// Usage: node scripts/generate_ugens_rust.mjs

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_DIR = join(ROOT, 'src', 'assets', 'ugens');
const OUT_DIR = join(ROOT, 'crates', 'scsynthdef-compiler', 'src', 'ugens');

const GENERATED_HEADER = [
  '// @generated — DO NOT EDIT.',
  '// Regenerate with `node scripts/generate_ugens_rust.mjs`.',
  '',
].join('\n');

// ── Rust literal emission ────────────────────────────────────────────────

/**
 * Emit a Rust raw-string literal with the minimum `#` count that avoids
 * collision with the content. Handles every possible input (quotes,
 * backslashes, newlines) without per-character escape logic.
 */
function rustStr(s) {
  let n = 0;
  while (s.includes('"' + '#'.repeat(n))) n++;
  const hashes = '#'.repeat(n);
  return `r${hashes}"${s}"${hashes}`;
}

function rustOptStr(s) {
  return s == null ? 'None' : `Some(${rustStr(s)})`;
}

function rustRate(r) {
  return { ar: 'Rate::Audio', kr: 'Rate::Control', ir: 'Rate::Scalar' }[r];
}

function rustFloat(n) {
  if (n == null) return 'None';
  // Always include `.0` for integer literals so the type matches Option<f32>.
  const s = Number.isInteger(n) ? `${n}.0` : `${n}`;
  return `Some(${s})`;
}

function emitEntry(u) {
  const rates = (u.rates || []).map(rustRate).filter(Boolean);
  const defaults = (u.defaults || []).map(
    ([name, value]) => `(${rustStr(name)}, ${rustFloat(value)})`,
  );
  const argDocsEntries = u.argDocs
    ? Object.entries(u.argDocs).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    : [];
  const argDocs = argDocsEntries.map(
    ([name, doc]) => `(${rustStr(name)}, ${rustStr(doc)})`,
  );
  const numOutputs = u.numOutputs == null ? 'None' : `Some(${u.numOutputs})`;

  return [
    '    UGenRegistryEntry {',
    `        name: ${rustStr(u.name)},`,
    `        rates: &[${rates.join(', ')}],`,
    defaults.length === 0
      ? '        defaults: &[],'
      : `        defaults: &[${defaults.join(', ')}],`,
    `        num_outputs: ${numOutputs},`,
    `        extends: ${rustOptStr(u.extends)},`,
    `        summary: ${rustOptStr(u.summary)},`,
    `        doc: ${rustOptStr(u.doc)},`,
    `        signal_range: ${rustOptStr(u.signalRange)},`,
    argDocs.length === 0
      ? '        arg_docs: &[],'
      : `        arg_docs: &[${argDocs.join(', ')}],`,
    '    },',
  ].join('\n');
}

function emitCategoryFile(ugens) {
  // Sort byte-wise so `binary_search_by(str::cmp)` on the Rust side works.
  const sorted = [...ugens].sort((a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  );
  const body = [
    GENERATED_HEADER,
    'use crate::registry::UGenRegistryEntry;',
    'use crate::Rate;',
    '',
    'pub(crate) const UGENS: &[UGenRegistryEntry] = &[',
    ...sorted.map(emitEntry),
    '];',
    '',
  ].join('\n');
  return body;
}

function emitModFile(categories) {
  const sorted = [...categories].sort();
  const modDecls = sorted.map((c) => `pub(crate) mod ${c};`);
  const slices = sorted.map((c) => `    ("${c}", ${c}::UGENS),`);
  return [
    GENERATED_HEADER,
    'use crate::registry::UGenRegistryEntry;',
    '',
    ...modDecls,
    '',
    '/// Every registry entry, grouped by the JSON source file it came from.',
    '/// Each inner slice is sorted by UGen name so `lookup_ugen` can binary',
    '/// search per slice. The first tuple element is the category name.',
    'pub(crate) const ALL_SLICES: &[(&str, &[UGenRegistryEntry])] = &[',
    ...slices,
    '];',
    '',
  ].join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────────

function main() {
  const jsonFiles = readdirSync(JSON_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  // Clear the output directory so removed categories don't leave stale files.
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const categories = [];
  let total = 0;
  for (const file of jsonFiles) {
    const category = basename(file, '.json');
    const ugens = JSON.parse(readFileSync(join(JSON_DIR, file), 'utf-8'));
    writeFileSync(join(OUT_DIR, `${category}.rs`), emitCategoryFile(ugens));
    categories.push(category);
    total += ugens.length;
    console.log(`  ${category}.rs: ${ugens.length} UGens`);
  }

  writeFileSync(join(OUT_DIR, 'mod.rs'), emitModFile(categories));
  console.log(
    `\nWritten ${total} UGens across ${categories.length} modules to ${OUT_DIR}`,
  );
}

main();
