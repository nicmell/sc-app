#!/usr/bin/env node

// Reads crates/scserver-commands/src/assets/commands/*.json and emits
// typed Rust builders + a lightweight registry.
//
//   crates/scserver-commands/src/builders/<category>.rs
//   crates/scserver-commands/src/builders/mod.rs
//   crates/scserver-commands/src/registry_data.rs
//
// Design: each command becomes a struct with **public fields** and a
// **single typed-parameter `new(...)` constructor**. Polymorphic args
// collapse into one of the enums in `src/args.rs` (`ControlId`,
// `NumericValue`, `ControlValue`). Repeated-tail groups become
// `Vec<(T1, T2, …)>`. Trailing args whose docstring mentions "optional"
// become `Option<T>` (kept out of the constructor; editable via struct
// update syntax).
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
  const body = address.replace(/^\//, '');
  return body
    .split('_')
    .map((seg) => (seg ? seg[0].toUpperCase() + seg.slice(1) : ''))
    .join('');
}

function rustIdent(name) {
  return RUST_RESERVED.has(name) ? `r#${name}` : name;
}

// Friendly names for the most common SC args, keyed on a cleaned docstring.
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
  bytes: 'bytes',
  '1 to receive notifications 0 to stop receiving them': 'enable',
  'client id optional': 'client_id',
  '0 for off 1 for on': 'enabled',
  'sound file header format': 'header_format',
  'sound file sample format': 'sample_format',
  '0 if synth 1 if group': 'kind',
};

function argNameFromDoc(doc, idx) {
  // Strip the "(optional ...)" / default trailer before matching overrides,
  // so "number of channels (optional. default = 1 channel)" picks up the
  // same override as "number of channels".
  const stripped = doc.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const cleaned = stripped
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (NAME_OVERRIDES[cleaned]) return NAME_OVERRIDES[cleaned];
  let short = cleaned.split(/\s+/).slice(0, 3).join('_');
  if (!short) return `arg${idx}`;
  if (/^\d/.test(short)) short = `arg_${short}`;
  return short;
}

function isOptional(doc) {
  return /\(optional/i.test(doc || '');
}

// ── Type classification ──────────────────────────────────────────────────

/// Map a JSON `type.alternatives` list to one of a small set of known
/// Rust types, plus a catch-all for anything variadic.
function classify(type) {
  const alts = ((type && type.alternatives) || []).slice().sort();
  if (alts.length === 0) return 'variadic';
  if (alts.length === 1) return alts[0]; // int32 / float32 / float64 / string / blob
  const key = alts.join('|');
  switch (key) {
    case 'int32|string':
      return 'ControlId';
    case 'float32|int32':
      return 'NumericValue';
    case 'float32|int32|string':
      return 'ControlValue';
    default:
      return 'variadic';
  }
}

function rustArgType(kind) {
  switch (kind) {
    case 'int32':
      return 'i32';
    case 'float32':
      return 'f32';
    case 'float64':
      return 'f64';
    case 'string':
      return 'String';
    case 'blob':
      return 'Vec<u8>';
    case 'ControlId':
      return 'crate::args::ControlId';
    case 'NumericValue':
      return 'crate::args::NumericValue';
    case 'ControlValue':
      return 'crate::args::ControlValue';
    default:
      return 'rosc::OscType';
  }
}

/// Emit a Rust expression converting `field_expr` of the given classified
/// type into an `OscType`. Moves `field_expr`.
function emitPushOsc(kind, fieldExpr) {
  switch (kind) {
    case 'int32':
      return `OscType::Int(${fieldExpr})`;
    case 'float32':
      return `OscType::Float(${fieldExpr})`;
    case 'float64':
      return `OscType::Double(${fieldExpr})`;
    case 'string':
      return `OscType::String(${fieldExpr})`;
    case 'blob':
      return `OscType::Blob(${fieldExpr})`;
    case 'ControlId':
    case 'NumericValue':
    case 'ControlValue':
      return `${fieldExpr}.into()`;
    default:
      return fieldExpr; // already an OscType
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

  // Dedupe arg names + classify each scalar arg + mark optional.
  const seen = new Map();
  const scalarInfos = scalarArgs.map((a, i) => {
    let name = argNameFromDoc(a.doc || '', i);
    const count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    if (count > 1) name = `${name}_${count}`;
    return {
      name: rustIdent(name),
      kind: classify(a.type),
      doc: a.doc,
      optional: isOptional(a.doc || ''),
    };
  });

  // Same for repeated-tuple fields.
  const repeatedInfos = repeated
    ? repeated.map((f, i) => ({
        name: argNameFromDoc(f.doc || '', i),
        kind: classify(f.type),
        doc: f.doc,
      }))
    : null;

  const required = scalarInfos.filter((a) => !a.optional);
  const optional = scalarInfos.filter((a) => a.optional);

  // ── Struct definition ────────────────────────────────────────────────
  lines.push('#[derive(Debug, Clone)]');
  lines.push(`pub struct ${structName} {`);
  for (const a of scalarInfos) {
    if (a.doc) for (const ln of rustDoc(a.doc, '    ')) lines.push(ln);
    const ty = rustArgType(a.kind);
    const wrapped = a.optional ? `Option<${ty}>` : ty;
    lines.push(`    pub ${a.name}: ${wrapped},`);
  }
  if (repeated) {
    const tupleTy = repeatedInfos
      .map((f) => rustArgType(f.kind))
      .join(', ');
    const tailDoc = repeatedInfos
      .map((f) => `${f.name}: ${f.doc || ''}`)
      .join('; ');
    lines.push(`    /// Repeated tuples (${tailDoc}).`);
    lines.push(`    pub tail: Vec<(${tupleTy})>,`);
  }
  lines.push('}');
  lines.push('');

  // ── impl ─────────────────────────────────────────────────────────────
  lines.push(`impl ${structName} {`);

  // Constructor — typed parameters for every required field + the tail.
  const ctorParams = [];
  for (const a of required) {
    ctorParams.push(`${a.name}: ${rustArgType(a.kind)}`);
  }
  if (repeated) {
    const tupleTy = repeatedInfos
      .map((f) => rustArgType(f.kind))
      .join(', ');
    ctorParams.push(`tail: Vec<(${tupleTy})>`);
  }

  const paramsStr = ctorParams.length === 0 ? '' : ctorParams.join(', ');
  lines.push(
    `    /// Construct \`${entry.address}\` with all required args. Optional`,
  );
  lines.push(
    `    /// fields default to \`None\` — set them via struct update syntax:`,
  );
  lines.push(`    /// \`${structName} { .. ${structName}::new(...) }\`.`);
  lines.push(`    pub fn new(${paramsStr}) -> Self {`);
  lines.push(`        Self {`);
  for (const a of required) lines.push(`            ${a.name},`);
  for (const a of optional) lines.push(`            ${a.name}: None,`);
  if (repeated) lines.push(`            tail,`);
  lines.push(`        }`);
  lines.push(`    }`);
  lines.push('');

  // to_message() — encode the typed fields to an OSC arg list.
  lines.push(`    /// Encode the typed fields into an \`OscType\` message.`);
  lines.push(`    pub fn to_message(self) -> ServerMessage {`);
  lines.push(`        let mut args: Vec<OscType> = Vec::new();`);
  // Iterate in source-declared order (mixing required + optional).
  for (const a of scalarInfos) {
    if (a.optional) {
      lines.push(`        if let Some(v) = self.${a.name} {`);
      lines.push(`            args.push(${emitPushOsc(a.kind, 'v')});`);
      lines.push(`        }`);
    } else {
      lines.push(
        `        args.push(${emitPushOsc(a.kind, `self.${a.name}`)});`,
      );
    }
  }
  if (repeated) {
    const tupleFields = repeatedInfos
      .map((_, i) => `t${i}`)
      .join(', ');
    lines.push(`        for (${tupleFields}) in self.tail {`);
    for (let i = 0; i < repeatedInfos.length; i++) {
      const f = repeatedInfos[i];
      lines.push(`            args.push(${emitPushOsc(f.kind, `t${i}`)});`);
    }
    lines.push(`        }`);
  }
  lines.push(
    `        ServerMessage::with_args(${rustStr(entry.address)}, args)`,
  );
  lines.push(`    }`);
  lines.push('');

  // encode() — shortcut to wire bytes.
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
  out.push('use rosc::OscType;');
  out.push('use crate::ServerMessage;');
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
