#!/usr/bin/env node

// Generates crates/scserver-commands/wit/commands.wit from the command
// catalogue. Emits:
//
//   - Variant types for the three polymorphic arg shapes used by the
//     registry (control-id, numeric-value, control-value).
//   - One `record <cmd>-args { … }` per command with non-zero args.
//   - One `<cmd>: func(args: <cmd>-args) -> server-message` per command
//     (or `func() -> server-message` for zero-arg commands like /status).
//
// Usage: node scripts/generate_server_commands_wit.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_DIR = join(
  ROOT, 'crates', 'scserver-commands', 'src', 'assets', 'commands',
);
const WIT_FILE = join(
  ROOT, 'crates', 'scserver-commands', 'wit', 'commands.wit',
);

const SKIP = new Set(['replies']);

const HEADER = [
  '// @generated — DO NOT EDIT.',
  '// Regenerate with `node scripts/generate_server_commands_wit.mjs`.',
  '',
  'package scserver:commands@0.1.0;',
  '',
].join('\n');

// WIT reserved words that require the `%` raw-identifier prefix.
const WIT_RESERVED = new Set([
  'use', 'type', 'func', 'resource', 'record', 'enum', 'flags', 'variant',
  'tuple', 'list', 'option', 'result', 'string', 'bool', 'interface',
  'world', 'import', 'export', 'package', 'include', 'constructor',
  'static', 'borrow', 'in', 'out', 'loop',
  'u8', 'u16', 'u32', 'u64', 's8', 's16', 's32', 's64', 'f32', 'f64',
  'char',
]);

// ── Name helpers ────────────────────────────────────────────────────────

function toKebab(s) {
  return s
    .replace(/_/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function witIdent(name) {
  const kebab = toKebab(name);
  return WIT_RESERVED.has(kebab) ? `%${kebab}` : kebab;
}

// Same per-arg naming convention as the Rust generator — keep them in
// lockstep so Rust's `SNew { def_name, … }` lines up with WIT's
// `def-name` field.
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
  const stripped = (doc || '').replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
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

// ── Type classification ─────────────────────────────────────────────────

function classify(type) {
  const alts = ((type && type.alternatives) || []).slice().sort();
  if (alts.length === 0) return 'variadic';
  if (alts.length === 1) return alts[0];
  const key = alts.join('|');
  switch (key) {
    case 'int32|string': return 'control-id';
    case 'float32|int32': return 'numeric-value';
    case 'float32|int32|string': return 'control-value';
    default: return 'variadic';
  }
}

function witType(kind) {
  switch (kind) {
    case 'int32': return 's32';
    case 'float32': return 'f32';
    case 'float64': return 'f64';
    case 'string': return 'string';
    case 'blob': return 'list<u8>';
    case 'control-id':
    case 'numeric-value':
    case 'control-value':
      return kind;
    default:
      return 'list<u8>'; // variadic — fall back to blob
  }
}

// ── Doc wrapping ────────────────────────────────────────────────────────

function rustDoc(text, indent) {
  if (!text) return [];
  const prefix = ' '.repeat(indent) + '/// ';
  const maxLen = 80 - prefix.length;
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
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
    .map((line) => `${prefix}${line}`);
}

// ── Per-command emission ────────────────────────────────────────────────

function analyze(entry) {
  const scalarArgs = [];
  let repeated = null;
  for (const a of entry.args || []) {
    if (a.repeated) repeated = a.fields;
    else scalarArgs.push(a);
  }

  const seen = new Map();
  const scalarInfos = scalarArgs.map((a, i) => {
    let name = argNameFromDoc(a.doc || '', i);
    const count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    if (count > 1) name = `${name}_${count}`;
    return {
      name,
      kind: classify(a.type),
      doc: a.doc,
      optional: isOptional(a.doc || ''),
    };
  });

  const repeatedInfos = repeated
    ? repeated.map((f, i) => ({
        name: argNameFromDoc(f.doc || '', i),
        kind: classify(f.type),
        doc: f.doc,
      }))
    : null;

  return { scalarInfos, repeatedInfos };
}

function emitCommand(entry) {
  const lines = [];
  const { scalarInfos, repeatedInfos } = analyze(entry);

  const funcName = toKebab(entry.address.replace(/^\//, ''));
  const recordName = `${funcName}-args`;
  const hasArgs = scalarInfos.length > 0 || repeatedInfos !== null;

  if (hasArgs) {
    // Record definition.
    if (entry.description) {
      for (const ln of rustDoc(entry.description, 4)) lines.push(ln);
    }
    lines.push(`    record ${recordName} {`);
    scalarInfos.forEach((a, i) => {
      if (a.doc) for (const ln of rustDoc(a.doc, 8)) lines.push(ln);
      const wt = witType(a.kind);
      const wrapped = a.optional ? `option<${wt}>` : wt;
      const sep = i < scalarInfos.length - 1 || repeatedInfos ? ',' : ',';
      lines.push(`        ${witIdent(a.name)}: ${wrapped}${sep}`);
    });
    if (repeatedInfos) {
      const tupleTy = repeatedInfos.map((f) => witType(f.kind)).join(', ');
      const tailDoc = repeatedInfos
        .map((f) => `${f.name}: ${f.doc || ''}`)
        .join('; ');
      lines.push(`        /// Repeated tuples (${tailDoc}).`);
      lines.push(`        tail: list<tuple<${tupleTy}>>,`);
    }
    lines.push(`    }`);
  }

  // Function declaration.
  if (entry.description) {
    for (const ln of rustDoc(entry.description, 4)) lines.push(ln);
  }
  lines.push(`    /// OSC address: \`${entry.address}\`.`);
  if (hasArgs) {
    lines.push(`    ${funcName}: func(args: ${recordName}) -> server-message;`);
  } else {
    lines.push(`    ${funcName}: func() -> server-message;`);
  }
  lines.push('');

  return lines.join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  const files = readdirSync(JSON_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const allEntries = [];
  for (const f of files) {
    const category = basename(f, '.json');
    if (SKIP.has(category)) continue;
    const entries = JSON.parse(readFileSync(join(JSON_DIR, f), 'utf8'));
    for (const e of entries) allEntries.push(e);
  }

  // Sort by address for a stable emit order.
  allEntries.sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));

  const out = [];
  out.push(HEADER);
  out.push('/// Typed, named-arg creators for every documented server command.');
  out.push('/// Mechanically derived from `src/assets/commands/*.json`.');
  out.push('interface commands {');
  out.push('    use core.{server-message};');
  out.push('');

  // Polymorphic variant types — only the three that actually appear in');
  // the catalogue.
  out.push('    /// Control identifier: index or name.');
  out.push('    variant control-id { index(s32), name(string) }');
  out.push('');
  out.push('    /// Numeric value: `int` or `float`.');
  out.push('    variant numeric-value { float(f32), int(s32) }');
  out.push('');
  out.push('    /// `/s_new` control value: `int` / `float` / bus reference string.');
  out.push('    variant control-value { float(f32), int(s32), bus(string) }');
  out.push('');

  for (const e of allEntries) out.push(emitCommand(e));

  out.push('}');
  out.push('');

  mkdirSync(dirname(WIT_FILE), { recursive: true });
  writeFileSync(WIT_FILE, out.join('\n'));
  console.log(`Wrote ${WIT_FILE} (${allEntries.length} commands)`);
}

main();
