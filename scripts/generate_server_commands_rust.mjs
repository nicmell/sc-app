#!/usr/bin/env node

// Reads crates/scserver-commands/src/assets/commands/*.json and emits
// typed Rust builders + a lightweight registry:
//
//   crates/scserver-commands/src/builders/<category>.rs
//   crates/scserver-commands/src/builders/mod.rs
//   crates/scserver-commands/src/registry_data.rs
//
// Usage: node scripts/generate_server_commands_rust.mjs

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  existsSync,
} from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_DIR = join(
  ROOT,
  'crates',
  'scserver-commands',
  'src',
  'assets',
  'commands',
);
const BUILDERS_DIR = join(
  ROOT,
  'crates',
  'scserver-commands',
  'src',
  'builders',
);
const REGISTRY_FILE = join(
  ROOT,
  'crates',
  'scserver-commands',
  'src',
  'registry_data.rs',
);

const HEADER = [
  '// @generated — DO NOT EDIT.',
  '// Regenerate with `node scripts/generate_server_commands_rust.mjs`.',
  '',
].join('\n');

// Rust keywords (kept short — full list is in generate_ugens_rust.mjs).
const RUST_RESERVED = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'do',
  'dyn', 'else', 'enum', 'extern', 'false', 'final', 'fn', 'for', 'if',
  'impl', 'in', 'let', 'loop', 'match', 'macro', 'mod', 'move', 'mut',
  'override', 'priv', 'pub', 'ref', 'return', 'self', 'static', 'struct',
  'super', 'trait', 'true', 'try', 'type', 'typeof', 'union', 'unsafe',
  'unsized', 'use', 'virtual', 'where', 'while', 'yield',
]);

// Replies live as parsers, not builders — a client doesn't encode them.
const SKIP_CATEGORIES = new Set(['replies']);

// ── Name synthesis ───────────────────────────────────────────────────────

function pascal(address) {
  // "/s_new" → "SNew", "/b_allocReadChannel" → "BAllocReadChannel",
  // "/n_free" → "NFree", "/status" → "Status".
  const body = address.replace(/^\//, '');
  return body
    .split('_')
    .map((seg, i) =>
      i === 0
        ? seg[0].toUpperCase() + seg.slice(1)
        : seg[0].toUpperCase() + seg.slice(1),
    )
    .join('');
}

function rustIdent(name) {
  return RUST_RESERVED.has(name) ? `r#${name}` : name;
}

function snake(s) {
  return s
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join('_')
    .toLowerCase();
}

// Friendly names for the most common SC args. Keys are the cleaned docstring.
const NAME_OVERRIDES = {
  'synth definition name': 'def_name',
  'synth id': 'node_id',
  'node id': 'node_id',
  'group id': 'group_id',
  'buffer number': 'bufnum',
  'buffer index': 'bufnum',
  'bus index': 'bus',
  'a control index or name': 'control',
  'a control value': 'value',
  'add action 0 1 2 3 or 4 see below': 'add_action',
  'add action 0 1 2 or 3 see below': 'add_action',
  'add target id': 'target_id',
  'command name': 'cmd',
  'path of a synth definition file': 'path',
  'path of a directory of synth definition files': 'path',
  'path of sound file': 'path',
  'path name of a sound file': 'path',
  'number of channels': 'num_channels',
  'number of frames': 'num_frames',
  'starting frame in buffer': 'starting_frame',
  'starting frame in file': 'start_frame',
  'starting sample index': 'start_index',
  'node id source': 'src_node_id',
  'node id target': 'target_node_id',
  'header format': 'header_format',
  'sample format': 'sample_format',
  'bytes': 'bytes',
  '1 to receive notifications 0 to stop receiving them': 'enable',
  'client id optional': 'client_id',
  '0 for off 1 for on': 'enabled',
  'sound file header format': 'header_format',
  'sound file sample format': 'sample_format',
  '0 if synth 1 if group': 'kind',
};

function argNameFromDoc(doc, idx) {
  const cleaned = doc.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (NAME_OVERRIDES[cleaned]) return NAME_OVERRIDES[cleaned];
  let short = cleaned.split(/\s+/).slice(0, 3).join('_');
  if (!short) return `arg${idx}`;
  // Rust identifiers can't start with a digit. Prefix if the first
  // scraped word is numeric (e.g. "1. unused." → "1_unused").
  if (/^\d/.test(short)) short = `arg_${short}`;
  return short;
}

// ── Rust emission helpers ────────────────────────────────────────────────

function oscTypeFor(type) {
  if (!type || !type.alternatives || type.alternatives.length === 0) return null;
  if (type.alternatives.length === 1) return type.alternatives[0];
  // Multiple alternatives → polymorphic. Use `OscType` and let the caller
  // pass anything `Into<OscType>`.
  return 'polymorphic';
}

function rustArgType(oscType) {
  switch (oscType) {
    case 'int32': return 'i32';
    case 'float32': return 'f32';
    case 'float64': return 'f64';
    case 'string': return 'String';
    case 'blob': return 'Vec<u8>';
    case 'polymorphic': return 'OscType';
    default: return 'OscType';
  }
}

function rustStr(s) {
  let n = 0;
  while (s.includes('"' + '#'.repeat(n))) n++;
  const hashes = '#'.repeat(n);
  return `r${hashes}"${s}"${hashes}`;
}

function rustDoc(text, indent = '') {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const prefix = indent + '/// ';
      const maxLen = 78 - prefix.length;
      const words = line.split(/\s+/).filter(Boolean);
      const out = [];
      let cur = '';
      for (const w of words) {
        if (cur.length + w.length + 1 > maxLen && cur.length > 0) {
          out.push(cur);
          cur = w;
        } else {
          cur = cur.length === 0 ? w : `${cur} ${w}`;
        }
      }
      if (cur.length > 0) out.push(cur);
      return out.length === 0 ? [''] : out;
    })
    .map((line) => `${indent}/// ${line}`);
}

// ── Single command → Rust struct ─────────────────────────────────────────

function emitBuilder(entry) {
  const structName = pascal(entry.address);
  const lines = [];

  // Doc block for the struct.
  if (entry.description) {
    for (const ln of rustDoc(entry.description)) lines.push(ln);
  }
  lines.push(`/// OSC address: \`${entry.address}\``);

  // Partition scalar args vs. repeated-tuple tail.
  const scalarArgs = [];
  let repeated = null;
  for (const a of entry.args || []) {
    if (a.repeated) {
      repeated = a.fields;
    } else {
      scalarArgs.push(a);
    }
  }

  // Dedupe arg names (two scalars might have the same inferred name).
  const fieldNames = [];
  const seen = new Map();
  scalarArgs.forEach((a, i) => {
    let n = argNameFromDoc(a.doc || '', i);
    const count = (seen.get(n) || 0) + 1;
    seen.set(n, count);
    if (count > 1) n = `${n}_${count}`;
    fieldNames.push(rustIdent(n));
  });

  // Struct definition.
  lines.push(`#[derive(Debug, Clone, Default)]`);
  lines.push(`pub struct ${structName} {`);
  scalarArgs.forEach((a, i) => {
    const ty = rustArgType(oscTypeFor(a.type));
    const optTy = `Option<${ty}>`;
    if (a.doc) for (const ln of rustDoc(a.doc, '    ')) lines.push(ln);
    lines.push(`    ${fieldNames[i]}: ${optTy},`);
  });
  if (repeated) {
    lines.push(`    /// Repeated tail group — one tuple per trailing entry.`);
    lines.push(`    tail: Vec<TailArgs>,`);
  }
  lines.push('}');
  lines.push('');

  lines.push(`impl ${structName} {`);
  lines.push(`    /// Construct a new ${entry.address} builder with no args set.`);
  lines.push(`    pub fn new() -> Self { Self::default() }`);
  lines.push('');

  // Setters.
  scalarArgs.forEach((a, i) => {
    const fname = fieldNames[i];
    const osc = oscTypeFor(a.type);
    const ty = rustArgType(osc);
    if (a.doc) for (const ln of rustDoc(a.doc, '    ')) lines.push(ln);
    if (osc === 'polymorphic') {
      lines.push(
        `    pub fn ${fname}(mut self, v: impl Into<OscType>) -> Self { self.${fname} = Some(v.into()); self }`,
      );
    } else {
      lines.push(
        `    pub fn ${fname}(mut self, v: ${ty}) -> Self { self.${fname} = Some(v); self }`,
      );
    }
    lines.push('');
  });

  // Repeated-tail add method.
  if (repeated) {
    const fieldDescs = repeated.map((f, i) => `${f.doc || 'tail arg ' + i}`);
    const params = repeated.map((_, i) => `a${i}: impl Into<OscType>`).join(', ');
    const pushes = repeated.map((_, i) => `a${i}.into()`).join(', ');
    lines.push(`    /// Append one tuple to the repeated tail.`);
    for (const f of fieldDescs) {
      for (const ln of rustDoc(f, '    ')) lines.push(ln);
    }
    lines.push(
      `    pub fn tail(mut self, ${params}) -> Self { self.tail.push(TailArgs(vec![${pushes}])); self }`,
    );
    lines.push('');
  }

  // to_message().
  lines.push(`    /// Build the encoded OSC message.`);
  lines.push(`    pub fn to_message(self) -> ServerMessage {`);
  lines.push(`        let mut args: Vec<OscType> = Vec::new();`);
  scalarArgs.forEach((a, i) => {
    const fname = fieldNames[i];
    const osc = oscTypeFor(a.type);
    if (osc === 'polymorphic') {
      lines.push(`        if let Some(v) = self.${fname} { args.push(v); }`);
    } else if (osc === 'int32') {
      lines.push(`        if let Some(v) = self.${fname} { args.push(OscType::Int(v)); }`);
    } else if (osc === 'float32') {
      lines.push(`        if let Some(v) = self.${fname} { args.push(OscType::Float(v)); }`);
    } else if (osc === 'float64') {
      lines.push(`        if let Some(v) = self.${fname} { args.push(OscType::Double(v)); }`);
    } else if (osc === 'string') {
      lines.push(`        if let Some(v) = self.${fname} { args.push(OscType::String(v)); }`);
    } else if (osc === 'blob') {
      lines.push(`        if let Some(v) = self.${fname} { args.push(OscType::Blob(v)); }`);
    } else {
      lines.push(`        if let Some(v) = self.${fname} { args.push(v); }`);
    }
  });
  if (repeated) {
    lines.push(`        for TailArgs(mut t) in self.tail { args.append(&mut t); }`);
  }
  lines.push(
    `        ServerMessage::with_args(${rustStr(entry.address)}, args)`,
  );
  lines.push(`    }`);
  lines.push('');
  lines.push(`    /// Shortcut: build + encode to OSC wire bytes.`);
  lines.push(`    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {`);
  lines.push(`        self.to_message().encode()`);
  lines.push(`    }`);
  lines.push(`}`);
  lines.push('');

  return lines.join('\n');
}

// ── Category file ───────────────────────────────────────────────────────

function emitCategoryFile(category, entries) {
  const out = [];
  out.push(HEADER);
  out.push('#![allow(non_snake_case, unused_mut, clippy::all)]');
  out.push('');
  const usesTail = entries.some((e) => (e.args || []).some((a) => a.repeated));
  out.push('use rosc::OscType;');
  out.push('use crate::ServerMessage;');
  if (usesTail) out.push('use crate::builders::TailArgs;');
  out.push('');
  for (const e of entries) out.push(emitBuilder(e));
  return out.join('\n');
}

function emitModFile(categories) {
  const sorted = [...categories].sort();
  const lines = [
    HEADER,
    '//! Typed builders for every documented SuperCollider server command.',
    '//! Auto-generated from `src/assets/commands/*.json`.',
    '',
    '/// Holder for one element of a command\'s repeated-tail group.',
    '#[derive(Debug, Clone, Default)]',
    'pub struct TailArgs(pub Vec<rosc::OscType>);',
    '',
  ];
  for (const c of sorted) lines.push(`pub mod ${c};`);
  lines.push('');
  for (const c of sorted) lines.push(`pub use ${c}::*;`);
  lines.push('');
  return lines.join('\n');
}

// ── Registry data (per-command metadata) ────────────────────────────────

function emitRegistry(entries) {
  const out = [];
  out.push(HEADER);
  out.push('use crate::registry::CommandEntry;');
  out.push('');
  out.push('pub(crate) const ALL_COMMANDS: &[CommandEntry] = &[');
  for (const e of entries) {
    out.push(`    CommandEntry {`);
    out.push(`        address: ${rustStr(e.address)},`);
    out.push(`        category: ${rustStr(e.category)},`);
    out.push(`        description: ${rustStr(e.description || '')},`);
    out.push(`    },`);
  }
  out.push('];');
  out.push('');
  return out.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  const files = readdirSync(JSON_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (existsSync(BUILDERS_DIR)) rmSync(BUILDERS_DIR, { recursive: true, force: true });
  mkdirSync(BUILDERS_DIR, { recursive: true });

  const categories = [];
  const allEntries = [];
  let total = 0;
  for (const f of files) {
    const category = basename(f, '.json');
    const entries = JSON.parse(readFileSync(join(JSON_DIR, f), 'utf8'));
    allEntries.push(...entries);
    if (SKIP_CATEGORIES.has(category)) continue;
    writeFileSync(
      join(BUILDERS_DIR, `${category}.rs`),
      emitCategoryFile(category, entries),
    );
    categories.push(category);
    total += entries.length;
    console.log(`  builders/${category}.rs: ${entries.length} commands`);
  }

  writeFileSync(join(BUILDERS_DIR, 'mod.rs'), emitModFile(categories));
  writeFileSync(REGISTRY_FILE, emitRegistry(allEntries));
  console.log(`\nEmitted ${total} commands across ${categories.length} modules`);
  console.log(`Registry data: ${allEntries.length} entries → ${REGISTRY_FILE}`);
}

main();
