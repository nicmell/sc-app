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
const BUILDERS_DIR = join(ROOT, 'crates', 'scsynthdef-compiler', 'src', 'builders');

// UGens that are internal to the SynthDef encoder (emitted automatically
// by `SynthDef::add_control` / reserved for operator nodes). No typed
// builder is produced for these — users create them via `add_control` or
// the `binary_op` / `unary_op` helpers.
const SKIP_BUILDERS = new Set([
  'Control', 'AudioControl', 'TrigControl', 'LagControl',
  'BinaryOpUGen', 'UnaryOpUGen',
]);

// Rust reserved words that require the `r#` raw-identifier prefix when
// used as field or method names.
const RUST_RESERVED = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'do',
  'dyn', 'else', 'enum', 'extern', 'false', 'final', 'fn', 'for', 'if',
  'impl', 'in', 'let', 'loop', 'match', 'macro', 'mod', 'move', 'mut',
  'override', 'priv', 'pub', 'ref', 'return', 'self', 'static', 'struct',
  'super', 'trait', 'true', 'try', 'type', 'typeof', 'union', 'unsafe',
  'unsized', 'use', 'virtual', 'where', 'while', 'yield',
]);

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

// ── Typed UGen builder emission ──────────────────────────────────────────

function toSnakeCase(s) {
  // channelsArray -> channels_array, maxDelayTime -> max_delay_time.
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

function rustIdent(name) {
  return RUST_RESERVED.has(name) ? `r#${name}` : name;
}

function argFieldName(argName) {
  return rustIdent(toSnakeCase(argName));
}

function rustRateVariant(r) {
  return { ar: 'Rate::Audio', kr: 'Rate::Control', ir: 'Rate::Scalar' }[r];
}

function rateCtorName(r) {
  return r;
}

function rustFloatLiteral(n) {
  if (n == null) return null;
  return Number.isInteger(n) ? `${n}.0` : `${n}`;
}

function wrapDoc(text) {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      // Wrap at ~80 chars by splitting on word boundaries.
      const words = line.split(/\s+/).filter(Boolean);
      const out = [];
      let cur = '';
      for (const w of words) {
        if (cur.length + w.length + 1 > 78 && cur.length > 0) {
          out.push(cur);
          cur = w;
        } else {
          cur = cur.length === 0 ? w : `${cur} ${w}`;
        }
      }
      if (cur.length > 0) out.push(cur);
      return out.length === 0 ? [''] : out;
    })
    .map((line) => `    /// ${line}`);
}

function emitBuilderStruct(entry) {
  if (SKIP_BUILDERS.has(entry.name)) return '';
  const defaults = entry.defaults || [];
  const argDocs = entry.argDocs || {};
  const rates = entry.rates || [];

  // Partition args:
  // - num_channels: tracked separately (affects num_outputs, not inputs)
  // - array args (channelsArray / inputArray): Vec<UGenInput>
  // - scalar args: UGenInput
  const scalarArgs = [];
  const arrayArgs = [];
  let hasNumChannels = false;
  for (const [name, def] of defaults) {
    if (name === 'numChannels') {
      hasNumChannels = true;
    } else if (name === 'channelsArray' || name === 'inputArray') {
      arrayArgs.push({ name, def });
    } else {
      scalarArgs.push({ name, def });
    }
  }

  const lines = [];

  // Struct doc
  const docLines = [];
  if (entry.summary) docLines.push(entry.summary.trim());
  if (entry.doc && entry.doc !== entry.summary) {
    if (docLines.length > 0) docLines.push('');
    docLines.push(entry.doc.trim());
  }
  if (docLines.length > 0) {
    for (const ln of wrapDoc(docLines.join('\n'))) lines.push(ln.replace(/^    /, ''));
  }
  lines.push(`pub struct ${entry.name} {`);
  lines.push(`    _rate: Rate,`);
  for (const { name } of scalarArgs) {
    lines.push(`    ${argFieldName(name)}: UGenInput,`);
  }
  for (const { name } of arrayArgs) {
    lines.push(`    ${argFieldName(name)}: Vec<UGenInput>,`);
  }
  if (hasNumChannels) {
    lines.push(`    num_channels: u32,`);
  }
  lines.push(`}`);
  lines.push('');

  // impl
  lines.push(`impl ${entry.name} {`);

  // Rate constructors
  for (const r of rates) {
    const ctorBody = [];
    ctorBody.push(`        Self {`);
    ctorBody.push(`            _rate: ${rustRateVariant(r)},`);
    for (const { name, def } of scalarArgs) {
      const lit = rustFloatLiteral(def);
      const init = lit != null ? `UGenInput::Constant(${lit})` : `UGenInput::Constant(0.0)`;
      ctorBody.push(`            ${argFieldName(name)}: ${init},`);
    }
    for (const { name } of arrayArgs) {
      ctorBody.push(`            ${argFieldName(name)}: Vec::new(),`);
    }
    if (hasNumChannels) {
      // numChannels' default (from JSON) if present, else 1.
      const ncEntry = defaults.find(([n]) => n === 'numChannels');
      const ncDefault =
        ncEntry && Number.isFinite(ncEntry[1]) ? Math.max(1, Math.round(ncEntry[1])) : 1;
      ctorBody.push(`            num_channels: ${ncDefault},`);
    }
    ctorBody.push(`        }`);

    lines.push(`    /// Build at ${r} rate (${rustRateVariant(r)}).`);
    lines.push(`    pub fn ${rateCtorName(r)}() -> Self {`);
    for (const l of ctorBody) lines.push(l);
    lines.push(`    }`);
    lines.push('');
  }

  // Setters for scalar args
  for (const { name } of scalarArgs) {
    const field = argFieldName(name);
    const doc = argDocs[name];
    if (doc) {
      for (const ln of wrapDoc(doc)) lines.push(ln);
    }
    lines.push(`    pub fn ${field}(mut self, v: impl Into<UGenInput>) -> Self {`);
    lines.push(`        self.${field} = v.into();`);
    lines.push(`        self`);
    lines.push(`    }`);
    lines.push('');
  }

  // Setters for array args
  for (const { name } of arrayArgs) {
    const field = argFieldName(name);
    const doc = argDocs[name];
    if (doc) {
      for (const ln of wrapDoc(doc)) lines.push(ln);
    }
    lines.push(
      `    pub fn ${field}<I, T>(mut self, iter: I) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> {`,
    );
    lines.push(`        self.${field} = iter.into_iter().map(Into::into).collect();`);
    lines.push(`        self`);
    lines.push(`    }`);
    lines.push('');
  }

  // num_channels setter
  if (hasNumChannels) {
    const doc = argDocs['numChannels'];
    if (doc) for (const ln of wrapDoc(doc)) lines.push(ln);
    lines.push(`    pub fn num_channels(mut self, n: u32) -> Self {`);
    lines.push(`        self.num_channels = n;`);
    lines.push(`        self`);
    lines.push(`    }`);
    lines.push('');
  }

  // build()
  const buildBody = [];
  buildBody.push(`        let mut inputs: Vec<UGenInput> = Vec::new();`);
  for (const { name } of scalarArgs) {
    buildBody.push(`        inputs.push(self.${argFieldName(name)});`);
  }
  // Wire-last ordering: arrayArgs appended after scalar args.
  for (const { name } of arrayArgs) {
    buildBody.push(`        inputs.extend(self.${argFieldName(name)});`);
  }
  if (hasNumChannels) {
    buildBody.push(`        let num_outputs: u32 = self.num_channels;`);
  } else {
    const declared = entry.numOutputs;
    const nout = declared == null ? 1 : declared;
    buildBody.push(`        let num_outputs: u32 = ${nout};`);
  }
  buildBody.push(`        let idx = def.add_ugen(${rustStr(entry.name)}, self._rate, inputs, num_outputs, 0);`);
  buildBody.push(`        UGenInput::UGen(idx)`);

  lines.push(`    /// Materialise this UGen into \`def\`'s node list.`);
  lines.push(`    /// Returns a handle usable as input to other UGens.`);
  lines.push(`    pub fn build(self, def: &mut SynthDef) -> UGenInput {`);
  for (const l of buildBody) lines.push(l);
  lines.push(`    }`);

  lines.push(`}`);
  lines.push('');

  return lines.join('\n');
}

function emitBuildersCategoryFile(category, entries) {
  const parts = [];
  parts.push(GENERATED_HEADER);
  parts.push('#![allow(non_camel_case_types, unused_mut, unused_variables, clippy::useless_conversion, clippy::needless_update)]');
  parts.push('');
  parts.push('use crate::{Rate, SynthDef, UGenInput};');
  parts.push('');

  let emittedAny = false;
  for (const entry of entries) {
    const block = emitBuilderStruct(entry);
    if (block) {
      parts.push(block);
      emittedAny = true;
    }
  }

  // Silence unused-import warnings for categories that skip every entry.
  if (!emittedAny) {
    parts.push('// (no typed builders emitted for this category)');
    parts.push('#[allow(unused_imports)]');
    parts.push('use crate::{Rate as _, SynthDef as _, UGenInput as _};');
  }

  return parts.join('\n');
}

function emitBuildersModFile(categories) {
  const sorted = [...categories].sort();
  const modDecls = sorted.map((c) => `pub mod ${c};`);
  const reExports = sorted.map((c) => `pub use ${c}::*;`);
  return [
    GENERATED_HEADER,
    '//! Typed UGen builders, one struct per bundled UGen. See the',
    "//! per-module documentation for the full catalogue — each struct's",
    '//! doc comment comes from `src/assets/ugens/*.json`.',
    '',
    ...modDecls,
    '',
    ...reExports,
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
  if (existsSync(BUILDERS_DIR)) rmSync(BUILDERS_DIR, { recursive: true, force: true });
  mkdirSync(BUILDERS_DIR, { recursive: true });

  const categories = [];
  let total = 0;
  for (const file of jsonFiles) {
    const category = basename(file, '.json');
    const ugens = JSON.parse(readFileSync(join(JSON_DIR, file), 'utf-8'));
    writeFileSync(join(OUT_DIR, `${category}.rs`), emitCategoryFile(ugens));
    writeFileSync(
      join(BUILDERS_DIR, `${category}.rs`),
      emitBuildersCategoryFile(category, ugens),
    );
    categories.push(category);
    total += ugens.length;
    console.log(`  ${category}.rs: ${ugens.length} UGens`);
  }

  writeFileSync(join(OUT_DIR, 'mod.rs'), emitModFile(categories));
  writeFileSync(
    join(BUILDERS_DIR, 'mod.rs'),
    emitBuildersModFile(categories),
  );
  console.log(
    `\nWritten ${total} UGens across ${categories.length} modules to:\n  - ${OUT_DIR}\n  - ${BUILDERS_DIR}`,
  );
}

main();
