#!/usr/bin/env node

// Generates `crates/scsynthdef-compiler/wit/scsynthdef.wit` from the
// curated JSON catalogue. The WIT file describes:
//
//   - the `core` interface: Rate, UGenInput, the SynthDef resource, and
//     the parse-scgf helper (hand-maintained here — small surface, stable
//     in the spec).
//   - the `ugens` interface: one function per bundled UGen, creating a
//     node inside a borrowed SynthDef and returning a UGenInput handle.
//
// Usage: node scripts/generate_wit.mjs

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_DIR = join(ROOT, 'src', 'assets', 'ugens');
const WIT_DIR = join(ROOT, 'crates', 'scsynthdef-compiler', 'wit');
const WIT_FILE = join(WIT_DIR, 'scsynthdef.wit');

// Matches the SKIP list in generate_ugens_rust.mjs — these UGens don't get
// a typed builder and likewise don't get a WIT function.
const SKIP = new Set([
  'Control', 'AudioControl', 'TrigControl', 'LagControl',
  'BinaryOpUGen', 'UnaryOpUGen',
]);

// WIT uses kebab-case for function names and identifiers. These keywords
// must be escaped with a leading `%`.
const WIT_RESERVED = new Set([
  'use', 'type', 'func', 'u8', 'u16', 'u32', 'u64', 's8', 's16', 's32',
  's64', 'f32', 'f64', 'char', 'resource', 'record', 'enum', 'flags',
  'variant', 'tuple', 'list', 'option', 'result', 'string', 'bool',
  'interface', 'world', 'import', 'export', 'package', 'include',
  'constructor', 'static', 'borrow', 'in', 'out',
]);

function toKebab(s) {
  // SinOsc → sin-osc, PV_Add → pv-add, maxDelayTime → max-delay-time
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

function wrapDoc(text, indent) {
  if (!text) return [];
  const prefix = ' '.repeat(indent) + '/// ';
  return text
    .split(/\r?\n/)
    .flatMap((line) => {
      const words = line.split(/\s+/).filter(Boolean);
      const out = [];
      let cur = '';
      const maxLen = 80 - prefix.length;
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

// ── Core interface (hand-maintained) ────────────────────────────────────

function coreInterface() {
  return `/// Core types + SynthDef resource, matching the SuperCollider SynthDef
/// File Format v2 binary layout.
///
/// Spec: https://doc.sccode.org/Reference/Synth-Definition-File-Format.html
interface core {
    /// Calculation rate byte (written at the start of each UGen spec in the
    /// binary). scalar = 0, control = 1, audio = 2.
    enum rate { scalar, control, audio }

    /// Input to a UGen. Mirrors the on-disk (ugen-index, output-index) pair:
    ///   - \`constant(value)\`          → the wire encoding writes ugen-index
    ///                                   = -1 and output-index = the constant's
    ///                                   slot in the constants table.
    ///   - \`ugen(synth-index)\`         → output 0 of the UGen at that node
    ///                                   position.
    ///   - \`ugen-output(node, slot)\`   → a specific output of a multi-output
    ///                                   UGen.
    variant ugen-input {
        constant(f32),
        ugen(u32),
        ugen-output(tuple<u32, u32>),
    }

    /// A SynthDef under construction. A v2 file carries exactly one of
    /// these — the spec's leading \`int16 number-of-synth-defs\` is always 1.
    resource synth-def {
        /// Start a new, empty SynthDef with the given name.
        constructor(name: string);

        /// Return the SynthDef's name, verbatim, as stored in its SCgf
        /// name pstring.
        name: func() -> string;

        /// Add a named control (parameter). Same-rate controls are grouped
        /// into a single \`Control\` / \`AudioControl\` UGen per sclang's
        /// convention. Returns a handle referring to the parameter's slot.
        add-control: func(name: string, default: f32, rate: rate) -> result<ugen-input, string>;

        /// Append a UGen node to the graph. Returns the node's synth-index.
        /// The typed UGen functions in the \`ugens\` interface wrap this.
        add-ugen: func(class-name: string, rate: rate, inputs: list<ugen-input>,
                       num-outputs: u32, special-index: s16) -> u32;

        /// Encode the SynthDef as a complete SCgf v2 binary file. Matches
        /// sclang's byte output for any graph whose controls are grouped the
        /// same way (kr-all / ar-all / mixed-contiguous).
        to-bytes: func() -> result<list<u8>, string>;

        /// Structured JSON representation mirroring the SCgf layout:
        /// \`{ name, constants, parameters, ugens, variants }\`.
        to-json: func() -> result<string, string>;
    }

    /// Parse SCgf v2 bytes into the structured JSON representation above.
    /// Inverse of \`synth-def.to-json\`.
    parse-scgf: func(bytes: list<u8>) -> result<string, string>;
}`;
}

// ── UGen functions (generated) ──────────────────────────────────────────

function ugenFunction(entry) {
  const fname = witIdent(entry.name);
  const defaults = entry.defaults || [];
  const argDocs = entry.argDocs || {};

  // Build params: def (borrow), rate, then one per non-numChannels arg.
  // numChannels is u32 (separate from ugen-input).
  const params = ['def: borrow<synth-def>', 'rate: rate'];
  const argNotes = [];
  for (const [name, _def] of defaults) {
    const id = witIdent(name);
    if (name === 'numChannels') {
      params.push(`${id}: u32`);
    } else if (name === 'channelsArray' || name === 'inputArray') {
      params.push(`${id}: list<ugen-input>`);
    } else {
      params.push(`${id}: ugen-input`);
    }
    const doc = argDocs[name];
    if (doc) argNotes.push(`  - \`${id}\`: ${doc.trim()}`);
  }

  const lines = [];

  // Function doc block.
  const docParts = [];
  if (entry.summary) docParts.push(entry.summary.trim());
  if (entry.doc && entry.doc !== entry.summary) {
    if (docParts.length > 0) docParts.push('');
    docParts.push(entry.doc.trim());
  }
  if (argNotes.length > 0) {
    if (docParts.length > 0) docParts.push('');
    docParts.push('Args:');
    for (const n of argNotes) docParts.push(n);
  }
  if (docParts.length > 0) {
    for (const ln of wrapDoc(docParts.join('\n'), 4)) lines.push(ln);
  }

  lines.push(
    `    ${fname}: func(${params.join(', ')}) -> ugen-input;`,
  );
  return lines.join('\n');
}

function ugensInterface(allEntries) {
  const body = [];
  body.push('/// Typed UGen creators — one function per bundled UGen in the');
  body.push('/// catalogue. Each call appends a UGen node to the borrowed');
  body.push('/// SynthDef and returns a handle that can be passed to other');
  body.push('/// UGens as an input. Auto-generated from the registry; keep in');
  body.push('/// sync by running `node scripts/generate_wit.mjs`.');
  body.push('interface ugens {');
  body.push('    use core.{rate, ugen-input, synth-def};');
  body.push('');
  body.push('    /// Return the full bundled UGen registry as JSON, grouped by');
  body.push('    /// source-file category: `[[category, [entries, …]], …]`.');
  body.push('    registry-json: func() -> string;');
  body.push('');

  const sortedEntries = allEntries
    .filter((e) => !SKIP.has(e.name))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

  for (const e of sortedEntries) {
    body.push(ugenFunction(e));
    body.push('');
  }

  body.push('}');
  return body.join('\n');
}

// ── World ───────────────────────────────────────────────────────────────

function worldBlock() {
  return `/// Canonical world for embedders of the scsynthdef compiler.
world scsynthdef {
    export core;
    export ugens;
}`;
}

// ── Main ────────────────────────────────────────────────────────────────

function main() {
  const files = readdirSync(JSON_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const allEntries = [];
  for (const f of files) {
    const entries = JSON.parse(readFileSync(join(JSON_DIR, f), 'utf-8'));
    for (const e of entries) allEntries.push(e);
  }

  if (!existsSync(WIT_DIR)) mkdirSync(WIT_DIR, { recursive: true });

  const parts = [
    '// @generated — DO NOT EDIT.',
    '// Regenerate with `node scripts/generate_wit.mjs`.',
    '',
    'package scsynthdef:compiler@0.1.0;',
    '',
    coreInterface(),
    '',
    ugensInterface(allEntries),
    '',
    worldBlock(),
    '',
  ];

  writeFileSync(WIT_FILE, parts.join('\n'));
  const total = allEntries.filter((e) => !SKIP.has(e.name)).length;
  console.log(`Wrote ${WIT_FILE} (${total} UGen functions)`);
}

main();
