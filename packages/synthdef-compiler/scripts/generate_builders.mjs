#!/usr/bin/env node
// Parse crates/scsynthdef-compiler/src/builders/*.rs and emit matching
// TypeScript typed UGen builders under packages/synthdef-compiler/src/builders/.
//
// Each Rust `pub struct X` becomes a TS class `X` with:
//   - static ar() / kr() / ir() constructors (only the rates present in Rust)
//   - one setter method per field (UGenInput fields accept `UGenInputLike`,
//     variadic Vec<UGenInput> fields accept an iterable of `UGenInputLike`,
//     `num_channels: u32` accepts a `number`)
//   - build(def: SynthDef): UGenInput
//
// Doc comments from the Rust source are preserved verbatim as JSDoc.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = join(__dirname, '..');
const CRATE_ROOT = join(PKG_ROOT, '..', '..', 'crates', 'scsynthdef-compiler');
const RUST_BUILDERS_DIR = join(CRATE_ROOT, 'src', 'builders');
const TS_BUILDERS_DIR = join(PKG_ROOT, 'src', 'builders');

const RATE_RUST_TO_TS = {
  'Rate::Audio': "'audio'",
  'Rate::Control': "'control'",
  'Rate::Scalar': "'scalar'",
};

const RATE_RUST_TO_METHOD = {
  'Rate::Audio': 'ar',
  'Rate::Control': 'kr',
  'Rate::Scalar': 'ir',
};

// ─── Tokenizer-ish helpers ──────────────────────────────────────────────────

/**
 * Strip a leading `r#` / trailing `_` keyword-escape from Rust idents.
 * Accepts both `r#in` and `r#loop` (emitted when the field name collides
 * with a Rust keyword). For TS we don't need escapes, we just drop them.
 */
function unmangleRustIdent(name) {
  if (name.startsWith('r#')) return name.slice(2);
  return name;
}

/** Convert a Rust snake_case ident to a TS camelCase ident. */
function toCamelCase(name) {
  const clean = unmangleRustIdent(name);
  return clean.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/**
 * Collect `///` doc lines immediately preceding `lineIdx` (no blank line
 * break). Returns the inner doc text (one string per line, comment marker
 * stripped), outer → inner order.
 */
function gatherDocs(lines, lineIdx) {
  const out = [];
  for (let i = lineIdx - 1; i >= 0; i--) {
    const l = lines[i];
    const trimmed = l.trim();
    if (trimmed.startsWith('///')) {
      out.unshift(trimmed.slice(3).replace(/^ /, ''));
    } else if (trimmed.length === 0) {
      // Allow blank inside the doc block only if another doc line above.
      // Stop — the generator never emits blank-line-inside-doc blocks.
      break;
    } else {
      break;
    }
  }
  return out;
}

/** Emit JSDoc for a given line-list (may be empty). */
function emitJsDoc(docs, indent) {
  if (docs.length === 0) return '';
  if (docs.length === 1) return `${indent}/** ${docs[0]} */\n`;
  const lines = [`${indent}/**`];
  for (const d of docs) lines.push(`${indent} * ${d}`);
  lines.push(`${indent} */`);
  return lines.join('\n') + '\n';
}

/** Escape a string for a TS double-quoted literal. */
function tsString(s) {
  return (
    '"' +
    s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t') +
    '"'
  );
}

// ─── Parsers for each major construct ───────────────────────────────────────

/**
 * Parse a single `pub struct Name { ... }` block. Returns:
 *   { rustName, tsName, fields: [{ rustName, tsName, kind }] }
 * where `kind` ∈ { 'ugenInput', 'vecUgenInput', 'u32', '_rate' }.
 */
function parseStruct(lines, startIdx) {
  const header = lines[startIdx].trim();
  const m = header.match(/^pub struct ([A-Za-z_][A-Za-z0-9_]*) \{$/);
  if (!m) throw new Error(`bad struct header at line ${startIdx + 1}: ${header}`);
  const rustName = m[1];

  const fields = [];
  let i = startIdx + 1;
  for (; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (t === '}') break;
    const fm = t.match(/^([A-Za-z_][A-Za-z0-9_#]*)\s*:\s*(.+),\s*$/);
    if (!fm) throw new Error(`bad struct field at line ${i + 1}: ${t}`);
    const fRustName = fm[1];
    const fType = fm[2].trim();
    let kind;
    if (fRustName === '_rate') kind = '_rate';
    else if (fType === 'UGenInput') kind = 'ugenInput';
    else if (fType === 'Vec<UGenInput>') kind = 'vecUgenInput';
    else if (fType === 'u32') kind = 'u32';
    else throw new Error(`unknown field type ${fType} on ${fRustName}`);
    fields.push({
      rustName: fRustName,
      tsName: toCamelCase(fRustName),
      kind,
    });
  }
  return { rustName, tsName: rustName, fields, endIdx: i };
}

/**
 * Parse an `impl Name { ... }` block, extracting all methods.
 * Returns { methods: [{ kind, ...specific }], endIdx }.
 */
function parseImpl(lines, startIdx) {
  const header = lines[startIdx].trim();
  const m = header.match(/^impl ([A-Za-z_][A-Za-z0-9_]*) \{$/);
  if (!m) throw new Error(`bad impl header at line ${startIdx + 1}: ${header}`);
  const rustName = m[1];

  const methods = [];
  let i = startIdx + 1;
  while (i < lines.length) {
    const l = lines[i];
    const t = l.trim();
    if (t === '}') return { rustName, methods, endIdx: i };

    // Skip blank and comment lines; they are consumed as docs by the
    // following method parser.
    if (t === '' || t.startsWith('//')) {
      i++;
      continue;
    }

    if (t.startsWith('pub fn ')) {
      const parsed = parseMethod(lines, i);
      methods.push(parsed);
      i = parsed.endIdx + 1;
      continue;
    }

    throw new Error(`unexpected line in impl at ${i + 1}: ${t}`);
  }
  throw new Error(`unterminated impl starting at line ${startIdx + 1}`);
}

/**
 * Parse one `pub fn ...` method inside an impl block. Returns:
 *   { kind: 'ctor' | 'setter' | 'build', endIdx, docs, ... }
 */
function parseMethod(lines, startIdx) {
  const docs = gatherDocs(lines, startIdx);
  const header = lines[startIdx].trim();

  // Constructor: `pub fn ar() -> Self {` (etc.)
  let m = header.match(/^pub fn (ar|kr|ir)\(\) -> Self \{$/);
  if (m) {
    const rateName = m[1];
    const body = collectMethodBody(lines, startIdx);
    const rateExpr = body.rateExpr;
    const defaults = body.fieldDefaults;
    return {
      kind: 'ctor',
      rateMethod: rateName,
      rateExpr,
      defaults,
      endIdx: body.endIdx,
      docs,
    };
  }

  // Setter (u32): `pub fn num_channels(mut self, n: u32) -> Self {`
  m = header.match(/^pub fn ([A-Za-z_][A-Za-z0-9_#]*)\(mut self, n: u32\) -> Self \{$/);
  if (m) {
    const body = collectMethodBody(lines, startIdx);
    return {
      kind: 'setterU32',
      field: m[1],
      endIdx: body.endIdx,
      docs,
    };
  }

  // Setter (UGenInput): `pub fn name(mut self, v: impl Into<UGenInput>) -> Self {`
  m = header.match(
    /^pub fn ([A-Za-z_][A-Za-z0-9_#]*)\(mut self, v: impl Into<UGenInput>\) -> Self \{$/,
  );
  if (m) {
    const body = collectMethodBody(lines, startIdx);
    return {
      kind: 'setterUgen',
      field: m[1],
      endIdx: body.endIdx,
      docs,
    };
  }

  // Setter (Vec<UGenInput>): `pub fn name<I, T>(mut self, iter: I) -> Self
  //   where I: IntoIterator<Item = T>, T: Into<UGenInput> {`
  m = header.match(
    /^pub fn ([A-Za-z_][A-Za-z0-9_#]*)<I, T>\(mut self, iter: I\) -> Self where I: IntoIterator<Item = T>, T: Into<UGenInput> \{$/,
  );
  if (m) {
    const body = collectMethodBody(lines, startIdx);
    return {
      kind: 'setterVec',
      field: m[1],
      endIdx: body.endIdx,
      docs,
    };
  }

  // build(): `pub fn build(self, def: &mut SynthDef) -> UGenInput {`
  if (header === 'pub fn build(self, def: &mut SynthDef) -> UGenInput {') {
    const body = collectMethodBody(lines, startIdx);
    return {
      kind: 'build',
      pushes: body.pushes, // array of { field, kind: 'push'|'extend' }
      numOutputs: body.numOutputs, // 'self.num_channels' or number literal
      rustClassName: body.rustClassName,
      specialIndex: body.specialIndex,
      endIdx: body.endIdx,
      docs,
    };
  }

  throw new Error(`unrecognized method signature at line ${startIdx + 1}: ${header}`);
}

/**
 * Read lines from a method's opening `{` until its matching `}` (depth-0
 * scan). Extracts the bits we care about from the body:
 *   - rateExpr: the `_rate: Rate::X,` initialiser (for ctors)
 *   - fieldDefaults: { fieldRustName: valueExpr } (for ctors)
 *   - pushes: ordered build-body push/extend list
 *   - numOutputs: raw RHS of `let num_outputs: u32 = …;`
 *   - rustClassName: the string literal passed to `def.add_ugen(r"X", …)`
 *   - specialIndex: last argument to `def.add_ugen(...)` (always `0` here)
 */
function collectMethodBody(lines, startIdx) {
  let depth = 1;
  let i = startIdx;
  // The opening `{` is at end of `lines[startIdx]`. Walk forward.
  let rateExpr = null;
  const fieldDefaults = {};
  const pushes = [];
  let numOutputs = null;
  let rustClassName = null;
  let specialIndex = null;
  i++;
  for (; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    // Count `{`/`}` — though in these methods we don't expect nested blocks,
    // just in case.
    for (const c of t) {
      if (c === '{') depth++;
      else if (c === '}') depth--;
    }
    if (depth === 0) break;

    // `_rate: Rate::Audio,` (inside Self { … })
    const rateLine = t.match(/^_rate:\s*(Rate::(?:Audio|Control|Scalar))\s*,\s*$/);
    if (rateLine) {
      rateExpr = rateLine[1];
      continue;
    }
    // field defaults inside the ctor's Self literal:
    //   field_name: UGenInput::Constant(-0.5),
    //   field_name: Vec::new(),
    //   num_channels: 1,
    const fieldInit = t.match(/^([A-Za-z_][A-Za-z0-9_#]*)\s*:\s*(.+),\s*$/);
    if (fieldInit && !t.startsWith('pub ') && !rateLine) {
      // Avoid collecting every random assignment — only ctor-body Self-init
      // lines are of the form `field: <expr>,` at indent 12 (3 levels).
      // Heuristic: only collect if the line is inside a ctor (we distinguish
      // later). We collect everything here and let the caller disambiguate.
      const key = fieldInit[1];
      // Skip 'rate' which was already handled.
      if (key !== '_rate') {
        fieldDefaults[key] = fieldInit[2].trim();
        continue;
      }
    }

    // build() body: push/extend, num_outputs, add_ugen
    const push = t.match(/^inputs\.push\(self\.([A-Za-z_][A-Za-z0-9_#]*)\);\s*$/);
    if (push) {
      pushes.push({ field: push[1], kind: 'push' });
      continue;
    }
    const extend = t.match(/^inputs\.extend\(self\.([A-Za-z_][A-Za-z0-9_#]*)\);\s*$/);
    if (extend) {
      pushes.push({ field: extend[1], kind: 'extend' });
      continue;
    }
    const no = t.match(/^let num_outputs: u32 = (.+);$/);
    if (no) {
      numOutputs = no[1].trim();
      continue;
    }
    // `let idx = def.add_ugen(r"Name", self._rate, inputs, num_outputs, 0);`
    const addUgen = t.match(
      /^let idx = def\.add_ugen\(r"([^"]+)",\s*self\._rate,\s*inputs,\s*num_outputs,\s*(-?\d+)\);$/,
    );
    if (addUgen) {
      rustClassName = addUgen[1];
      specialIndex = parseInt(addUgen[2], 10);
      continue;
    }
  }
  return {
    rateExpr,
    fieldDefaults,
    pushes,
    numOutputs,
    rustClassName,
    specialIndex,
    endIdx: i,
  };
}

// ─── TS emitter ─────────────────────────────────────────────────────────────

/** Convert Rust `UGenInput::Constant(-0.5)` → TS `-0.5`. */
function ugenInputInit(expr) {
  const m = expr.match(/^UGenInput::Constant\(([^)]+)\)$/);
  if (!m) throw new Error(`expected UGenInput::Constant(...): ${expr}`);
  const n = m[1].trim().replace(/f32$/, '');
  return formatNumberLiteral(n);
}

function formatNumberLiteral(s) {
  // Rust uses `-0.0`, `1.0`, `440.0`, `0.01`, `1e-6`, etc. Parse to double
  // and re-emit using JS's default stringification — stable and
  // round-tripping for these shortish decimals.
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`bad number: ${s}`);
  if (Object.is(n, -0)) return '-0';
  if (Number.isInteger(n)) return `${n}`;
  return `${n}`;
}

function emitBuilder(struct, methods, category) {
  const ctors = methods.filter((m) => m.kind === 'ctor');
  const setters = methods.filter((m) => m.kind.startsWith('setter'));
  const build = methods.find((m) => m.kind === 'build');
  if (!build) throw new Error(`${struct.rustName}: missing build()`);

  // Collect class-level docs from the struct line.
  const lines = [];
  const className = struct.tsName;

  // Preserved struct-level docs come from the caller (they live above
  // `pub struct X`).
  if (struct.docs && struct.docs.length) {
    lines.push(emitJsDoc(struct.docs, '').trimEnd());
  }
  lines.push(`export class ${className} {`);

  // Instance fields (rate + per-arg fields), typed.
  // Internal rate uses `_calcRate` to avoid collision with a user field
  // literally named `rate` (e.g. PlayBuf, VDiskIn, Phasor).
  lines.push(`  private _calcRate!: Rate;`);
  for (const f of struct.fields) {
    if (f.kind === '_rate') continue;
    if (f.kind === 'ugenInput') {
      lines.push(`  private _${f.tsName}!: UGenInput;`);
    } else if (f.kind === 'vecUgenInput') {
      lines.push(`  private _${f.tsName}!: UGenInput[];`);
    } else if (f.kind === 'u32') {
      lines.push(`  private _${f.tsName}!: number;`);
    }
  }
  lines.push('');

  // Private no-arg constructor; instances are populated by the static
  // ar/kr/ir factories below.
  lines.push(`  private constructor() {}`);
  lines.push('');

  // Static ctors.
  for (const c of ctors) {
    const docs = c.docs.length ? c.docs : [];
    if (docs.length) lines.push(emitJsDoc(docs, '  ').trimEnd());
    lines.push(`  static ${c.rateMethod}(): ${className} {`);
    lines.push(`    const b = new ${className}();`);
    lines.push(`    b._calcRate = ${RATE_RUST_TO_TS[c.rateExpr]};`);
    for (const f of struct.fields) {
      if (f.kind === '_rate') continue;
      const defExpr = c.defaults[f.rustName];
      if (defExpr === undefined) {
        throw new Error(
          `${struct.rustName}.${c.rateMethod}: missing default for field ${f.rustName}`,
        );
      }
      if (f.kind === 'ugenInput') {
        lines.push(`    b._${f.tsName} = { tag: 'constant', val: ${ugenInputInit(defExpr)} };`);
      } else if (f.kind === 'vecUgenInput') {
        if (defExpr !== 'Vec::new()') {
          throw new Error(
            `${struct.rustName}.${c.rateMethod}: unexpected vec default ${defExpr}`,
          );
        }
        lines.push(`    b._${f.tsName} = [];`);
      } else if (f.kind === 'u32') {
        lines.push(`    b._${f.tsName} = ${parseInt(defExpr, 10)};`);
      }
    }
    lines.push(`    return b;`);
    lines.push(`  }`);
    lines.push('');
  }

  // Setters.
  for (const s of setters) {
    const fieldRust = s.field;
    const fieldTs = toCamelCase(fieldRust);
    const structField = struct.fields.find((f) => f.rustName === fieldRust);
    if (!structField) {
      throw new Error(`${struct.rustName}: setter for unknown field ${fieldRust}`);
    }
    if (s.docs.length) lines.push(emitJsDoc(s.docs, '  ').trimEnd());
    if (s.kind === 'setterUgen') {
      lines.push(`  ${fieldTs}(v: UGenInputLike): this {`);
      lines.push(`    this._${fieldTs} = toUGenInput(v);`);
      lines.push(`    return this;`);
      lines.push(`  }`);
    } else if (s.kind === 'setterVec') {
      lines.push(`  ${fieldTs}(iter: Iterable<UGenInputLike>): this {`);
      lines.push(`    const arr: UGenInput[] = [];`);
      lines.push(`    for (const v of iter) arr.push(toUGenInput(v));`);
      lines.push(`    this._${fieldTs} = arr;`);
      lines.push(`    return this;`);
      lines.push(`  }`);
    } else if (s.kind === 'setterU32') {
      lines.push(`  ${fieldTs}(n: number): this {`);
      lines.push(`    this._${fieldTs} = n;`);
      lines.push(`    return this;`);
      lines.push(`  }`);
    }
    lines.push('');
  }

  // build().
  if (build.docs.length) lines.push(emitJsDoc(build.docs, '  ').trimEnd());
  else lines.push(`  /** Materialise this UGen into \`def\`'s node list. Returns a handle usable as input to other UGens. */`);
  lines.push(`  build(def: SynthDef): UGenInput {`);
  lines.push(`    const inputs: UGenInput[] = [];`);
  for (const p of build.pushes) {
    const fieldTs = toCamelCase(p.field);
    if (p.kind === 'push') {
      lines.push(`    inputs.push(this._${fieldTs});`);
    } else {
      lines.push(`    inputs.push(...this._${fieldTs});`);
    }
  }
  // num_outputs.
  let numOutputsTs;
  if (build.numOutputs.startsWith('self.')) {
    const f = build.numOutputs.slice(5);
    numOutputsTs = `this._${toCamelCase(f)}`;
  } else {
    numOutputsTs = `${parseInt(build.numOutputs, 10)}`;
  }
  lines.push(
    `    const idx = def.addUgen(${tsString(build.rustClassName)}, this._calcRate, inputs, ${numOutputsTs}, ${build.specialIndex});`,
  );
  lines.push(`    return { tag: 'ugen', val: idx };`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push('');

  return lines.join('\n');
}

// ─── File-level driver ─────────────────────────────────────────────────────

function parseFile(src) {
  const lines = src.split('\n');
  const structs = new Map(); // rustName → struct (fields + docs)
  const implMethods = new Map(); // rustName → methods[]

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith('pub struct ')) {
      const s = parseStruct(lines, i);
      // Gather docs above the struct line.
      s.docs = gatherDocs(lines, i);
      structs.set(s.rustName, s);
      i = s.endIdx;
      continue;
    }
    if (t.startsWith('impl ')) {
      const im = parseImpl(lines, i);
      implMethods.set(im.rustName, im.methods);
      i = im.endIdx;
      continue;
    }
  }

  return { structs, implMethods };
}

function emitModule(category) {
  const src = readFileSync(join(RUST_BUILDERS_DIR, `${category}.rs`), 'utf8');
  const { structs, implMethods } = parseFile(src);

  const out = [];
  out.push('// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.');
  out.push('//');
  out.push(`// Ported from crates/scsynthdef-compiler/src/builders/${category}.rs.`);
  out.push('');
  out.push("import { Rate } from '../rate.js';");
  out.push("import { SynthDef } from '../synthdef.js';");
  out.push(
    "import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';",
  );
  out.push('');

  // Emit structs in source order (iterate Map preserves insertion order).
  const names = [...structs.keys()];
  for (const rustName of names) {
    const struct = structs.get(rustName);
    const methods = implMethods.get(rustName) || [];
    out.push(emitBuilder(struct, methods, category));
  }

  return { names, source: out.join('\n') };
}

function main() {
  const files = readdirSync(RUST_BUILDERS_DIR)
    .filter((f) => f.endsWith('.rs') && f !== 'mod.rs')
    .sort();

  const categoryNames = [];
  const indexReExports = [];
  let totalClasses = 0;

  for (const f of files) {
    const category = f.replace(/\.rs$/, '');
    categoryNames.push(category);
    const { names, source } = emitModule(category);
    writeFileSync(join(TS_BUILDERS_DIR, `${category}.ts`), source);
    totalClasses += names.length;
    indexReExports.push({ category, names });
  }

  // Emit index.ts re-exporting every builder class. Use `export *` to
  // match the Rust `pub use category::*;` aggregation.
  const idx = [];
  idx.push('// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.');
  idx.push('//');
  idx.push('// Ported from crates/scsynthdef-compiler/src/builders/mod.rs.');
  idx.push('');
  for (const c of categoryNames) {
    idx.push(`export * from './${c}.js';`);
  }
  idx.push('');
  writeFileSync(join(TS_BUILDERS_DIR, 'index.ts'), idx.join('\n'));

  console.log(
    `generated ${categoryNames.length} builder files, ${totalClasses} UGen classes total`,
  );
}

main();
