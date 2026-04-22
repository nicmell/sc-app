#!/usr/bin/env node

// Single-pass code generator for scserver-commands.
//
// Reads `src/assets/commands/*.json` once and emits four artefacts:
//
//   - `src/builders/<category>.rs` + `src/builders/mod.rs`
//     (typed Rust constructors, one struct per command)
//   - `src/registry.rs`
//     (one `pub const REGISTRY_JSON: &str` string, fed straight to the
//     WIT `core.registry-json` function)
//   - `wit/commands.wit`
//     (typed WIT `commands` interface, one record + one func per command)
//   - `src/component_commands.rs`
//     (Guest impl forwarding each WIT func to the matching Rust builder)
//
// Usage: node scripts/generate.mjs  (run from the crate root)

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

const HERE = dirname(fileURLToPath(import.meta.url));
const CRATE = dirname(HERE); // scripts/ lives directly under the crate root

const JSON_DIR = join(CRATE, 'src', 'assets', 'commands');
const BUILDERS_DIR = join(CRATE, 'src', 'builders');
const REGISTRY_FILE = join(CRATE, 'src', 'registry.rs');
const COMPONENT_FILE = join(CRATE, 'src', 'component_commands.rs');
const WIT_FILE = join(CRATE, 'wit', 'commands.wit');

const HEADER = [
  '// @generated — DO NOT EDIT.',
  '// Regenerate with `node scripts/generate.mjs` (from the crate root).',
  '',
].join('\n');

const SKIP_CATEGORIES = new Set(['replies']);

// Rust reserved words — need `r#` prefix when used as field / fn names.
const RUST_RESERVED = new Set([
  'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'do',
  'dyn', 'else', 'enum', 'extern', 'false', 'final', 'fn', 'for', 'if',
  'impl', 'in', 'let', 'loop', 'match', 'macro', 'mod', 'move', 'mut',
  'override', 'priv', 'pub', 'ref', 'return', 'self', 'static', 'struct',
  'super', 'trait', 'true', 'try', 'type', 'typeof', 'union', 'unsafe',
  'unsized', 'use', 'virtual', 'where', 'while', 'yield',
]);

// WIT reserved words — need `%` prefix for identifiers.
const WIT_RESERVED = new Set([
  'use', 'type', 'func', 'resource', 'record', 'enum', 'flags', 'variant',
  'tuple', 'list', 'option', 'result', 'string', 'bool', 'interface',
  'world', 'import', 'export', 'package', 'include', 'constructor',
  'static', 'borrow', 'in', 'out', 'loop',
  'u8', 'u16', 'u32', 'u64', 's8', 's16', 's32', 's64', 'f32', 'f64',
  'char',
]);

// ── Name synthesis ──────────────────────────────────────────────────────

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
  // Friendlier names for common trailing optionals.
  'an osc message to execute upon completion': 'completion_msg',
  'the required sample rate': 'sample_rate',
};

function argNameFromDoc(doc, idx) {
  // Strip "(optional …)" / default trailer before override lookup,
  // handling nested parens by repeatedly peeling innermost groups.
  let stripped = doc || '';
  while (/\([^()]*\)/.test(stripped)) {
    stripped = stripped.replace(/\([^()]*\)/g, '');
  }
  stripped = stripped.replace(/\s+/g, ' ').trim();
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

/// SC-capitalised pascal (`/dumpOSC` → `DumpOSC`). Used for the Rust
/// builder struct name + the matching `builders::<Name>` path.
function pascalBuilder(address) {
  return address
    .replace(/^\//, '')
    .split('_')
    .map((seg) => (seg ? seg[0].toUpperCase() + seg.slice(1) : ''))
    .join('');
}

/// wit-bindgen-normalised pascal (`/dumpOSC` → `DumpOsc`). Used for the
/// WIT arg-record type name wit-bindgen emits on the Rust side.
function pascalWit(address) {
  return toKebab(address.replace(/^\//, ''))
    .split('-')
    .map((seg) => (seg ? seg[0].toUpperCase() + seg.slice(1) : ''))
    .join('');
}

function fnSnake(address) {
  return address
    .replace(/^\//, '')
    .split('_')
    .map((seg) => seg.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase())
    .join('_');
}

// ── Type classification ─────────────────────────────────────────────────

function classify(type) {
  const alts = ((type && type.alternatives) || []).slice().sort();
  if (alts.length === 0) return 'variadic';
  if (alts.length === 1) return alts[0];
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
    case 'int32': return 'i32';
    case 'float32': return 'f32';
    case 'float64': return 'f64';
    case 'string': return 'String';
    case 'blob': return 'Vec<u8>';
    case 'ControlId': return 'crate::args::ControlId';
    case 'NumericValue': return 'crate::args::NumericValue';
    case 'ControlValue': return 'crate::args::ControlValue';
    default: return 'rosc::OscType';
  }
}

function witArgType(kind) {
  switch (kind) {
    case 'int32': return 's32';
    case 'float32': return 'f32';
    case 'float64': return 'f64';
    case 'string': return 'string';
    case 'blob': return 'list<u8>';
    case 'ControlId':
    case 'NumericValue':
    case 'ControlValue':
      return toKebab(kind);
    default:
      return 'list<u8>';
  }
}

function pushOscExpr(kind, expr) {
  switch (kind) {
    case 'int32': return `OscType::Int(${expr})`;
    case 'float32': return `OscType::Float(${expr})`;
    case 'float64': return `OscType::Double(${expr})`;
    case 'string': return `OscType::String(${expr})`;
    case 'blob': return `OscType::Blob(${expr})`;
    case 'ControlId':
    case 'NumericValue':
    case 'ControlValue':
      return `${expr}.into()`;
    default:
      return expr;
  }
}

function witToRustExpr(kind, expr) {
  switch (kind) {
    case 'ControlId':
      return `match ${expr} {
                wit_cmd::ControlId::Index(i) => crate::args::ControlId::Index(i),
                wit_cmd::ControlId::Name(s) => crate::args::ControlId::Name(s),
            }`;
    case 'NumericValue':
      return `match ${expr} {
                wit_cmd::NumericValue::Float(f) => crate::args::NumericValue::Float(f),
                wit_cmd::NumericValue::Int(i) => crate::args::NumericValue::Int(i),
            }`;
    case 'ControlValue':
      return `match ${expr} {
                wit_cmd::ControlValue::Float(f) => crate::args::ControlValue::Float(f),
                wit_cmd::ControlValue::Int(i) => crate::args::ControlValue::Int(i),
                wit_cmd::ControlValue::Bus(s) => crate::args::ControlValue::Bus(s),
            }`;
    case 'variadic':
      return `rosc::OscType::Blob(${expr})`;
    default:
      return expr;
  }
}

// ── Rust literal helpers ────────────────────────────────────────────────

function rustStr(s) {
  let n = 0;
  while (s.includes('"' + '#'.repeat(n))) n++;
  const hashes = '#'.repeat(n);
  return `r${hashes}"${s}"${hashes}`;
}

function docLines(text, indent) {
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

// ── Per-command analysis (shared by all emitters) ───────────────────────

function analyze(entry) {
  const scalarArgs = [];
  let repeated = null;
  for (const a of entry.args || []) {
    if (a.repeated) repeated = a.fields;
    else scalarArgs.push(a);
  }

  const seen = new Map();
  const scalars = scalarArgs.map((a, i) => {
    let name = argNameFromDoc(a.doc || '', i);
    const count = (seen.get(name) || 0) + 1;
    seen.set(name, count);
    if (count > 1) name = `${name}_${count}`;
    return {
      name,
      rustName: rustIdent(name),
      witName: witIdent(name),
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

  return { scalars, repeated: repeatedInfos };
}

// ── Rust builder (per command) ──────────────────────────────────────────

function emitBuilder(entry) {
  const name = pascalBuilder(entry.address);
  const { scalars, repeated } = analyze(entry);
  const required = scalars.filter((a) => !a.optional);
  const optional = scalars.filter((a) => a.optional);

  const out = [];
  if (entry.description) for (const l of docLines(entry.description, 0)) out.push(l);
  out.push(`/// OSC address: \`${entry.address}\``);
  out.push('#[derive(Debug, Clone)]');
  out.push(`pub struct ${name} {`);
  for (const a of scalars) {
    if (a.doc) for (const l of docLines(a.doc, 4)) out.push(l);
    const ty = rustArgType(a.kind);
    const wrapped = a.optional ? `Option<${ty}>` : ty;
    out.push(`    pub ${a.rustName}: ${wrapped},`);
  }
  if (repeated) {
    const tupleTy = repeated.map((f) => rustArgType(f.kind)).join(', ');
    const tailDoc = repeated.map((f) => `${f.name}: ${f.doc || ''}`).join('; ');
    out.push(`    /// Repeated tuples (${tailDoc}).`);
    out.push(`    pub tail: Vec<(${tupleTy})>,`);
  }
  out.push('}');
  out.push('');

  // Constructor params: required scalars + (if present) the tail.
  const ctorParams = required.map((a) => `${a.rustName}: ${rustArgType(a.kind)}`);
  if (repeated) {
    const tupleTy = repeated.map((f) => rustArgType(f.kind)).join(', ');
    ctorParams.push(`tail: Vec<(${tupleTy})>`);
  }

  out.push(`impl ${name} {`);
  out.push(`    /// Construct \`${entry.address}\` with all required args. Optional`);
  out.push(`    /// fields default to \`None\` — override via struct update syntax:`);
  out.push(`    /// \`${name} { .. ${name}::new(...) }\`.`);
  out.push(`    pub fn new(${ctorParams.join(', ')}) -> Self {`);
  out.push(`        Self {`);
  for (const a of required) out.push(`            ${a.rustName},`);
  for (const a of optional) out.push(`            ${a.rustName}: None,`);
  if (repeated) out.push(`            tail,`);
  out.push(`        }`);
  out.push(`    }`);
  out.push('');

  // to_message — encode in source-declared arg order.
  out.push(`    /// Encode the typed fields into an OSC \`ServerMessage\`.`);
  out.push(`    pub fn to_message(self) -> ServerMessage {`);
  out.push(`        let mut args: Vec<OscType> = Vec::new();`);
  for (const a of scalars) {
    if (a.optional) {
      out.push(`        if let Some(v) = self.${a.rustName} {`);
      out.push(`            args.push(${pushOscExpr(a.kind, 'v')});`);
      out.push(`        }`);
    } else {
      out.push(`        args.push(${pushOscExpr(a.kind, `self.${a.rustName}`)});`);
    }
  }
  if (repeated) {
    const fields = repeated.map((_, i) => `t${i}`).join(', ');
    out.push(`        for (${fields}) in self.tail {`);
    for (let i = 0; i < repeated.length; i++) {
      out.push(`            args.push(${pushOscExpr(repeated[i].kind, `t${i}`)});`);
    }
    out.push(`        }`);
  }
  out.push(`        ServerMessage::with_args(${rustStr(entry.address)}, args)`);
  out.push(`    }`);
  out.push('');
  out.push(`    /// Shortcut: build + encode to OSC wire bytes.`);
  out.push(`    pub fn encode(self) -> Result<Vec<u8>, crate::CommandError> {`);
  out.push(`        self.to_message().encode()`);
  out.push(`    }`);
  out.push(`}`);
  out.push('');
  return out.join('\n');
}

function emitBuildersCategoryFile(entries) {
  const out = [HEADER];
  out.push('#![allow(non_snake_case, unused_mut, clippy::all)]');
  out.push('');
  out.push('use rosc::OscType;');
  out.push('use crate::ServerMessage;');
  out.push('');
  for (const e of entries) out.push(emitBuilder(e));
  return out.join('\n');
}

function emitBuildersMod(categories) {
  const sorted = [...categories].sort();
  return [
    HEADER,
    '//! Typed builders for every documented SuperCollider server command.',
    '//! Auto-generated from `src/assets/commands/*.json`.',
    '',
    ...sorted.map((c) => `pub mod ${c};`),
    '',
    ...sorted.map((c) => `pub use ${c}::*;`),
    '',
  ].join('\n');
}

// ── WIT commands interface ──────────────────────────────────────────────

function witDoc(text, indent) {
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

function emitWitCommand(entry) {
  const { scalars, repeated } = analyze(entry);
  const funcKebab = toKebab(entry.address.replace(/^\//, ''));
  const recordName = `${funcKebab}-args`;
  const hasArgs = scalars.length > 0 || repeated !== null;

  const lines = [];
  if (hasArgs) {
    if (entry.description) for (const l of witDoc(entry.description, 4)) lines.push(l);
    lines.push(`    record ${recordName} {`);
    for (const a of scalars) {
      if (a.doc) for (const l of witDoc(a.doc, 8)) lines.push(l);
      const wt = witArgType(a.kind);
      const wrapped = a.optional ? `option<${wt}>` : wt;
      lines.push(`        ${a.witName}: ${wrapped},`);
    }
    if (repeated) {
      const tupleTy = repeated.map((f) => witArgType(f.kind)).join(', ');
      const tailDoc = repeated.map((f) => `${f.name}: ${f.doc || ''}`).join('; ');
      lines.push(`        /// Repeated tuples (${tailDoc}).`);
      lines.push(`        tail: list<tuple<${tupleTy}>>,`);
    }
    lines.push(`    }`);
  }
  if (entry.description) for (const l of witDoc(entry.description, 4)) lines.push(l);
  lines.push(`    /// OSC address: \`${entry.address}\`.`);
  if (hasArgs) {
    lines.push(`    ${funcKebab}: func(args: ${recordName}) -> server-message;`);
  } else {
    lines.push(`    ${funcKebab}: func() -> server-message;`);
  }
  lines.push('');
  return lines.join('\n');
}

function emitWit(entries) {
  const sorted = [...entries].sort((a, b) =>
    a.address < b.address ? -1 : a.address > b.address ? 1 : 0,
  );
  const out = [
    HEADER,
    'package scserver:commands@0.1.0;',
    '',
    '/// Typed, named-arg creators for every documented server command.',
    '/// Mechanically derived from `src/assets/commands/*.json`.',
    'interface commands {',
    '    use core.{server-message};',
    '',
    '    /// Control identifier: index or name.',
    '    variant control-id { index(s32), name(string) }',
    '',
    '    /// Numeric value: `int` or `float`.',
    '    variant numeric-value { float(f32), int(s32) }',
    '',
    '    /// `/s_new` control value: `int` / `float` / bus reference string.',
    '    variant control-value { float(f32), int(s32), bus(string) }',
    '',
  ];
  for (const e of sorted) out.push(emitWitCommand(e));
  out.push('}');
  out.push('');
  return out.join('\n');
}

// ── Component forwarder (Rust Guest impl) ───────────────────────────────

function emitForwarder(entry) {
  const fnRust = fnSnake(entry.address);
  const builder = pascalBuilder(entry.address);
  const witArgs = `${pascalWit(entry.address)}Args`;
  const { scalars, repeated } = analyze(entry);
  const required = scalars.filter((a) => !a.optional);
  const optional = scalars.filter((a) => a.optional);
  const hasArgs = scalars.length > 0 || repeated !== null;

  const out = [];
  out.push(`    fn ${fnRust}(`);
  if (hasArgs) out.push(`        args: wit_cmd::${witArgs},`);
  out.push(`    ) -> WitServerMessageResource {`);

  const ctorArgs = [];
  for (const a of required) {
    if (['ControlId', 'NumericValue', 'ControlValue'].includes(a.kind)) {
      out.push(`        let ${a.rustName} = ${witToRustExpr(a.kind, `args.${a.rustName}`)};`);
      ctorArgs.push(a.rustName);
    } else if (a.kind === 'variadic') {
      out.push(`        let ${a.rustName} = rosc::OscType::Blob(args.${a.rustName});`);
      ctorArgs.push(a.rustName);
    } else {
      ctorArgs.push(`args.${a.rustName}`);
    }
  }

  if (repeated) {
    const conversions = repeated.map((f, i) => {
      const v = `t.${i}`;
      if (['ControlId', 'NumericValue', 'ControlValue'].includes(f.kind)) {
        return witToRustExpr(f.kind, v);
      }
      if (f.kind === 'variadic') return `rosc::OscType::Blob(${v})`;
      return v;
    });
    out.push(`        let tail: Vec<_> = args.tail.into_iter().map(|t| (${conversions.join(', ')})).collect();`);
    ctorArgs.push('tail');
  }

  if (optional.length === 0) {
    out.push(`        let msg = crate::builders::${builder}::new(${ctorArgs.join(', ')}).to_message();`);
  } else {
    out.push(`        let msg = crate::builders::${builder} {`);
    for (const a of optional) {
      if (a.kind === 'variadic') {
        out.push(`            ${a.rustName}: args.${a.rustName},`);
      } else if (['ControlId', 'NumericValue', 'ControlValue'].includes(a.kind)) {
        out.push(`            ${a.rustName}: args.${a.rustName}.map(|v| ${witToRustExpr(a.kind, 'v')}),`);
      } else {
        out.push(`            ${a.rustName}: args.${a.rustName},`);
      }
    }
    out.push(`            ..crate::builders::${builder}::new(${ctorArgs.join(', ')})`);
    out.push(`        }.to_message();`);
  }

  out.push(`        WitServerMessageResource::new(crate::component::ServerMessageResource::new(msg))`);
  out.push(`    }`);
  return out.join('\n');
}

function emitComponentForwarders(entries) {
  const sorted = [...entries].sort((a, b) =>
    a.address < b.address ? -1 : a.address > b.address ? 1 : 0,
  );
  const out = [
    HEADER,
    'use crate::component::bindings::exports::scserver::commands::commands as wit_cmd;',
    'use crate::component::{Component, ServerMessageResource};',
    'use crate::component::bindings::exports::scserver::commands::core::ServerMessage as WitServerMessageResource;',
    '',
    'impl wit_cmd::Guest for Component {',
  ];
  for (const e of sorted) out.push(emitForwarder(e));
  out.push('}');
  out.push('');
  return out.join('\n');
}

// ── Registry (REGISTRY_JSON const) ──────────────────────────────────────

function emitRegistry(allEntries) {
  const minimal = allEntries.map((e) => ({
    address: e.address,
    category: e.category,
    description: e.description,
  }));
  const json = JSON.stringify(minimal);
  return [
    HEADER,
    '//! The full command / reply catalogue, inlined as a JSON string so',
    '//! the WIT `core.registry-json` function can return it verbatim.',
    '',
    `pub(crate) const REGISTRY_JSON: &str = ${rustStr(json)};`,
    '',
  ].join('\n');
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  const files = readdirSync(JSON_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const categories = [];
  const commandEntries = [];
  const allEntries = [];
  for (const f of files) {
    const category = basename(f, '.json');
    const entries = JSON.parse(readFileSync(join(JSON_DIR, f), 'utf8'));
    allEntries.push(...entries);
    if (SKIP_CATEGORIES.has(category)) continue;
    categories.push({ category, entries });
    commandEntries.push(...entries);
  }

  // builders/
  if (existsSync(BUILDERS_DIR)) rmSync(BUILDERS_DIR, { recursive: true, force: true });
  mkdirSync(BUILDERS_DIR, { recursive: true });
  for (const { category, entries } of categories) {
    writeFileSync(join(BUILDERS_DIR, `${category}.rs`), emitBuildersCategoryFile(entries));
    console.log(`  builders/${category}.rs: ${entries.length} commands`);
  }
  writeFileSync(join(BUILDERS_DIR, 'mod.rs'), emitBuildersMod(categories.map((c) => c.category)));

  // registry.rs
  writeFileSync(REGISTRY_FILE, emitRegistry(allEntries));

  // wit/commands.wit
  mkdirSync(dirname(WIT_FILE), { recursive: true });
  writeFileSync(WIT_FILE, emitWit(commandEntries));

  // src/component_commands.rs
  writeFileSync(COMPONENT_FILE, emitComponentForwarders(commandEntries));

  console.log(`\nEmitted ${commandEntries.length} commands across ${categories.length} categories`);
  console.log(`Registry: ${allEntries.length} entries`);
}

main();
