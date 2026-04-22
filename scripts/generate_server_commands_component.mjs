#!/usr/bin/env node

// Emits crates/scserver-commands/src/component_commands.rs: a Guest
// implementation of the `scserver:commands/commands` WIT interface that
// forwards every typed command to the corresponding Rust builder.
//
// Usage: node scripts/generate_server_commands_component.mjs
//
// Prerequisite: run the WIT + Rust builder generators first so the
// record / builder names line up:
//   node scripts/generate_server_commands_wit.mjs
//   node scripts/generate_server_commands_rust.mjs

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_DIR = join(
  ROOT, 'crates', 'scserver-commands', 'src', 'assets', 'commands',
);
const OUT_FILE = join(
  ROOT, 'crates', 'scserver-commands', 'src', 'component_commands.rs',
);

const SKIP = new Set(['replies']);

const HEADER = [
  '// @generated — DO NOT EDIT.',
  '// Regenerate with `node scripts/generate_server_commands_component.mjs`.',
  '',
].join('\n');

// Shared with the other two generators — keep in lockstep.
const RUST_RESERVED = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'do',
  'dyn', 'else', 'enum', 'extern', 'false', 'final', 'fn', 'for', 'if',
  'impl', 'in', 'let', 'loop', 'match', 'macro', 'mod', 'move', 'mut',
  'override', 'priv', 'pub', 'ref', 'return', 'self', 'static', 'struct',
  'super', 'trait', 'true', 'try', 'type', 'typeof', 'union', 'unsafe',
  'unsized', 'use', 'virtual', 'where', 'while', 'yield',
]);

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

function rustIdent(name) {
  return RUST_RESERVED.has(name) ? `r#${name}` : name;
}

function classify(type) {
  const alts = ((type && type.alternatives) || []).slice().sort();
  if (alts.length === 0) return 'variadic';
  if (alts.length === 1) return alts[0];
  const key = alts.join('|');
  switch (key) {
    case 'int32|string': return 'ControlId';
    case 'float32|int32': return 'NumericValue';
    case 'float32|int32|string': return 'ControlValue';
    default: return 'variadic';
  }
}

/// The builder struct name on the Rust side. Matches
/// `scripts/generate_server_commands_rust.mjs` exactly, keeping SC
/// capitalisation inside each `_`-segment (`/dumpOSC` → `DumpOSC`).
function pascalBuilder(address) {
  const body = address.replace(/^\//, '');
  return body
    .split('_')
    .map((seg) => (seg ? seg[0].toUpperCase() + seg.slice(1) : ''))
    .join('');
}

/// The wit-bindgen-normalised Rust name for a WIT identifier: it first
/// kebab-cases the input (upper→lower after each camel boundary) and
/// then rejoins segments with each first letter uppercased. So
/// `/dumpOSC` becomes `DumpOsc` (not `DumpOSC`) in the jco / bindings
/// output.
function pascalWit(address) {
  const body = address.replace(/^\//, '');
  // Match the kebab pipeline used in generate_server_commands_wit.mjs.
  const kebab = body
    .replace(/_/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
  return kebab
    .split('-')
    .map((seg) => (seg ? seg[0].toUpperCase() + seg.slice(1) : ''))
    .join('');
}

function fnName(address) {
  // /s_new → s_new (snake_case — Rust side)
  const body = address.replace(/^\//, '');
  return body
    .split('_')
    .map((seg) =>
      seg.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
    )
    .join('_');
}

// Map a classified kind to the WIT→Rust conversion snippet. `v` is the
// variable name holding the WIT value.
function convertFromWit(kind, v) {
  switch (kind) {
    case 'ControlId':
      return `match ${v} {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }`;
    case 'NumericValue':
      return `match ${v} {
                wit_cmd::NumericValue::Float(f) => crate::args::NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => crate::args::NumericValue::Int(i),
            }`;
    case 'ControlValue':
      return `match ${v} {
                wit_cmd::ControlValue::Float(f) => crate::args::ControlValue::Float(f),
                wit_cmd::ControlValue::Int(i) => crate::args::ControlValue::Int(i),
                wit_cmd::ControlValue::Bus(s) => crate::args::ControlValue::Bus(s),
            }`;
    case 'variadic':
      // Variadic fallback arg came in as `list<u8>` — pass through as
      // Blob. (Used for /b_gen / /cmd / /u_cmd whose trailing args are
      // genuinely open-ended.)
      return `rosc::OscType::Blob(${v})`;
    default:
      // Primitive types pass through directly (the builder takes them
      // already in the right type).
      return v;
  }
}

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
      name: rustIdent(name),
      kind: classify(a.type),
      optional: isOptional(a.doc || ''),
    };
  });

  const repeatedInfos = repeated
    ? repeated.map((f, i) => ({
        kind: classify(f.type),
      }))
    : null;

  return { scalarInfos, repeatedInfos };
}

function emitForwarder(entry) {
  const fnRust = fnName(entry.address);
  const builderName = pascalBuilder(entry.address);
  const witArgsName = `${pascalWit(entry.address)}Args`;
  const { scalarInfos, repeatedInfos } = analyze(entry);

  const hasArgs = scalarInfos.length > 0 || repeatedInfos !== null;
  const required = scalarInfos.filter((a) => !a.optional);
  const optional = scalarInfos.filter((a) => a.optional);

  const lines = [];
  lines.push(`    fn ${fnRust}(`);
  if (hasArgs) {
    lines.push(`        args: wit_cmd::${witArgsName},`);
  }
  lines.push(`    ) -> WitServerMessageResource {`);

  // Build the list of ctor-positional args.
  const ctorArgs = [];
  for (const a of required) {
    if (a.kind === 'ControlId' || a.kind === 'NumericValue' || a.kind === 'ControlValue') {
      lines.push(`        let ${a.name} = ${convertFromWit(a.kind, `args.${a.name}`)};`);
      ctorArgs.push(a.name);
    } else if (a.kind === 'variadic') {
      lines.push(`        let ${a.name} = rosc::OscType::Blob(args.${a.name});`);
      ctorArgs.push(a.name);
    } else {
      ctorArgs.push(`args.${a.name}`);
    }
  }

  // Tail conversion (if any).
  if (repeatedInfos) {
    const fieldConversions = repeatedInfos.map((f, i) => {
      const v = `t.${i}`;
      if (f.kind === 'ControlId' || f.kind === 'NumericValue' || f.kind === 'ControlValue') {
        return convertFromWit(f.kind, v);
      }
      if (f.kind === 'variadic') {
        return `rosc::OscType::Blob(${v})`;
      }
      return v;
    });
    lines.push(`        let tail: Vec<_> = args.tail.into_iter().map(|t| (${fieldConversions.join(', ')})).collect();`);
    ctorArgs.push('tail');
  }

  // Build the main expr using struct update syntax when we have optionals.
  if (optional.length === 0) {
    lines.push(
      `        let msg = crate::builders::${builderName}::new(${ctorArgs.join(', ')}).to_message();`,
    );
  } else {
    // struct update: base via ::new(...) then override each optional field.
    const overrides = optional.map((a) => {
      if (a.kind === 'variadic') {
        // Optional variadic → Option<Vec<u8>> on both sides.
        return `            ${a.name}: args.${a.name},`;
      }
      if (a.kind === 'ControlId' || a.kind === 'NumericValue' || a.kind === 'ControlValue') {
        return `            ${a.name}: args.${a.name}.map(|v| ${convertFromWit(a.kind, 'v')}),`;
      }
      return `            ${a.name}: args.${a.name},`;
    });
    lines.push(`        let msg = crate::builders::${builderName} {`);
    for (const o of overrides) lines.push(o);
    lines.push(`            ..crate::builders::${builderName}::new(${ctorArgs.join(', ')})`);
    lines.push(`        }.to_message();`);
  }

  lines.push(`        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))`);
  lines.push(`    }`);

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
  allEntries.sort((a, b) => (a.address < b.address ? -1 : a.address > b.address ? 1 : 0));

  const out = [];
  out.push(HEADER);
  out.push('use crate::component::bindings::exports::scserver::commands::commands as wit_cmd;');
  out.push('use crate::component::{Component, ServerMessageResource};');
  out.push('use crate::component::bindings::exports::scserver::commands::core::ServerMessage as WitServerMessageResource;');
  out.push('');
  out.push('impl wit_cmd::Guest for Component {');

  for (const e of allEntries) out.push(emitForwarder(e));

  out.push('}');
  out.push('');

  writeFileSync(OUT_FILE, out.join('\n'));
  console.log(`Wrote ${OUT_FILE} (${allEntries.length} commands)`);
}

main();
