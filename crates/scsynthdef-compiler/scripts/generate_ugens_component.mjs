#!/usr/bin/env node
// Generate the `interface ugens { ... }` block in wit/scsynthdef.wit and
// the matching src/ugens_component.rs Guest impl, both from the bundled
// UGen registry (src/specs/*.rs) and the canonical PascalCase names
// pulled from src/builders/*.rs.
//
// The WIT surface exposes each UGen as
//     <name>: func(def, ugen-rate, args: <name>-args) -> ugen-input;
// where <name>-args is a record with one field per UGen-specific arg.
// Fields with a documented default in the registry become
// `option<ugen-input>` / `option<u32>`; fields without one are required.
// Variadic `list<ugen-input>` fields are always required.
//
// Zero deps beyond node-builtins. Run from the crate root:
//   node scripts/generate_ugens_component.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRATE_ROOT = join(__dirname, "..");
const WIT_PATH = join(CRATE_ROOT, "wit", "scsynthdef.wit");
const UGENS_DIR = join(CRATE_ROOT, "src", "specs");
const BUILDERS_DIR = join(CRATE_ROOT, "src", "builders");
const OUT_PATH = join(CRATE_ROOT, "src", "ugens_component.rs");

// ── Rust keyword list (2021 edition + reserved) ────────────────────────────
// wit-bindgen-rust appends `_` to any arg/method/field name that collides
// with a Rust keyword. We mirror that here so the generated idents line up
// with the Guest trait wit-bindgen emits.
const RUST_KEYWORDS = new Set([
    "as", "break", "const", "continue", "crate", "else", "enum", "extern",
    "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod",
    "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct",
    "super", "trait", "true", "type", "unsafe", "use", "where", "while",
    "async", "await", "dyn",
    // reserved
    "abstract", "become", "box", "do", "final", "macro", "override", "priv",
    "typeof", "unsized", "virtual", "yield", "try",
]);

function escapeRustIdent(name) {
    return RUST_KEYWORDS.has(name) ? `${name}_` : name;
}

function kebabToSnake(k) {
    return k.replace(/-/g, "_");
}

function kebabToUpperCamel(k) {
    // Used for the wit-bindgen record type name: `sin-osc-args` → `SinOscArgs`.
    // Digit-letter runs stay glued (e.g. `a2-k-args` → `A2KArgs`).
    return k
        .split("-")
        .filter(s => s.length > 0)
        .map(s => s[0].toUpperCase() + s.slice(1))
        .join("");
}

// ── Pascal→kebab (heck ToKebabCase compatible) ─────────────────────────────
function pascalToKebabHeck(s) {
    if (!s) return s;
    const chars = [...s];
    const isUpper = c => c >= "A" && c <= "Z";
    const isLower = c => c >= "a" && c <= "z";
    const isDigit = c => c >= "0" && c <= "9";
    const out = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        const prev = chars[i - 1];
        const next = chars[i + 1];
        if (i > 0) {
            if ((isLower(prev) || isDigit(prev)) && isUpper(c)) {
                out.push("-");
            } else if (
                isUpper(prev) && isUpper(c) && next && isLower(next)
            ) {
                out.push("-");
            }
        }
        if (c === "_") {
            if (out.length && out[out.length - 1] !== "-") out.push("-");
        } else {
            out.push(c.toLowerCase());
        }
    }
    return out.join("").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

// lowerCamel → kebab, sharing the same boundary rules (works for
// `sendID` → `send-id`, `attackTime` → `attack-time`, `channelsArray`
// → `channels-array`, `numChannels` → `num-channels`).
function camelToKebabHeck(s) { return pascalToKebabHeck(s); }

function normalizeKebab(k) {
    // Strip leading `%`, strip all `-` for lookup. The WIT generator
    // occasionally writes a dash where heck omits one (e.g. `a2-k` vs
    // heck's `a2k`); dash-stripping normalises both forms.
    return k.replace(/^%/, "").replace(/-/g, "");
}

// ── Collect Pascal names from src/builders/*.rs ────────────────────────────
function collectPascalNames() {
    const files = readdirSync(BUILDERS_DIR).filter(f => f.endsWith(".rs"));
    const names = new Set();
    for (const f of files) {
        const txt = readFileSync(join(BUILDERS_DIR, f), "utf8");
        for (const line of txt.split("\n")) {
            const m = line.match(/^pub struct ([A-Za-z_][A-Za-z0-9_]*)\b/);
            if (m) names.add(m[1]);
        }
    }
    return [...names].sort();
}

function buildKebabToPascal(pascalNames) {
    const normToPascal = new Map();
    const collisions = [];
    for (const p of pascalNames) {
        const kebab = pascalToKebabHeck(p);
        const norm = normalizeKebab(kebab);
        if (normToPascal.has(norm) && normToPascal.get(norm) !== p) {
            collisions.push([norm, normToPascal.get(norm), p]);
        } else {
            normToPascal.set(norm, p);
        }
    }
    if (collisions.length) {
        console.error("fatal: kebab-normalization collisions:");
        for (const [n, a, b] of collisions) console.error(`  ${n}: ${a} vs ${b}`);
        process.exit(1);
    }
    return normToPascal;
}

// ── Registry parser (src/specs/*.rs) ───────────────────────────────────────
// Build Pascal-name → [{ kebab, default: number|null }, ...] by parsing
// each UGenRegistryEntry's `name:` and `defaults:` lines. All defaults
// arrays fit on one line; the name line precedes the defaults line.
function parseRegistryDefaults() {
    const byPascal = new Map();
    const files = readdirSync(UGENS_DIR).filter(
        f => f.endsWith(".rs") && f !== "mod.rs"
    );
    for (const f of files) {
        const txt = readFileSync(join(UGENS_DIR, f), "utf8");
        const re = /UGenRegistryEntry\s*\{\s*\n\s*name:\s*r"([^"]+)",\s*\n\s*rates:[^\n]*\n\s*defaults:\s*&\[([^\]]*)\]/g;
        let m;
        while ((m = re.exec(txt)) !== null) {
            const name = m[1];
            const tuples = m[2];
            const args = [];
            const tre = /\(r"([^"]+)",\s*(None|Some\(\s*([-0-9.eE+]+)\s*\))\s*\)/g;
            let tm;
            while ((tm = tre.exec(tuples)) !== null) {
                args.push({
                    kebab: camelToKebabHeck(tm[1]),
                    default: tm[2] === "None" ? null : parseFloat(tm[3]),
                });
            }
            byPascal.set(name, args);
        }
    }
    return byPascal;
}

// ── WIT parser ─────────────────────────────────────────────────────────────
function extractUgensInterfaceSpan(witLines) {
    // Return { startLine, endLine, startIdx, endIdx } of the `interface
    // ugens { ... }` block in the given array of lines (inclusive, 0-based).
    let startIdx = -1;
    for (let i = 0; i < witLines.length; i++) {
        if (/^interface\s+ugens\s*\{/.test(witLines[i])) { startIdx = i; break; }
    }
    if (startIdx < 0) throw new Error("could not find `interface ugens {` in WIT");
    for (let i = startIdx + 1; i < witLines.length; i++) {
        if (/^\}\s*$/.test(witLines[i])) {
            return { startIdx, endIdx: i };
        }
    }
    throw new Error("could not find closing `}` for `interface ugens`");
}

function extractDocComments(witLines, startIdx, funcLineIdx) {
    // Walk upward from funcLineIdx-1 collecting `/// ...` lines (and blank
    // lines between docs are NOT part of the doc block — we stop on the
    // first non-doc, non-blank line). Preserve indentation.
    const out = [];
    for (let i = funcLineIdx - 1; i > startIdx; i--) {
        const l = witLines[i];
        if (/^\s*\/\/\//.test(l)) out.unshift(l);
        else if (/^\s*$/.test(l)) break;
        else break;
    }
    return out;
}

// Parse each `<name>: func(args) -> ret;` declaration from the current
// WIT `ugens` interface body, capturing doc comments and the full arg
// list (with %-escapes intact). Returns an array of { kebab, argList,
// docLines, returnType } sorted by file order (preserved).
function parseCurrentUgensFuncs(witLines, startIdx, endIdx) {
    const funcs = [];
    for (let i = startIdx + 1; i < endIdx; i++) {
        const l = witLines[i];
        const stripped = l.replace(/\/\/[^\/].*$/, ""); // drop trailing // comments but keep ///
        const m = stripped.match(/^\s*(%?[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*func\s*\(([^)]*)\)\s*->\s*([^;]+);/);
        if (!m) continue;
        const kebab = m[1];
        const argsStr = m[2].trim();
        const ret = m[3].trim();
        const argList = [];
        if (argsStr.length > 0) {
            const parts = splitTopLevelCommas(argsStr);
            for (const p of parts) {
                const mm = p.trim().match(/^(%?[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*(.+)$/);
                if (!mm) throw new Error(`unparseable arg in ${kebab}: ${p}`);
                argList.push({
                    rawName: mm[1],
                    name: mm[1].replace(/^%/, ""),
                    type: mm[2].trim(),
                });
            }
        }
        const docLines = extractDocComments(witLines, startIdx, i);
        funcs.push({ kebab, argList, returnType: ret, docLines });
    }
    return funcs;
}

function splitTopLevelCommas(s) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (c === "<") depth++;
        else if (c === ">") depth--;
        else if (c === "," && depth === 0) {
            parts.push(s.slice(start, i));
            start = i + 1;
        }
    }
    parts.push(s.slice(start));
    return parts;
}

// ── Synthesis ──────────────────────────────────────────────────────────────
// For each UGen func, combine the WIT arg list (post-`def`/`ugen-rate`)
// with the registry's by-position defaults to produce:
//   - the record fields (rawName, wit-type, rust-type, rust-field-name)
//   - the Rust impl body (unpack → delegate_ugen)
function synthesize(func, pascal, registryArgs) {
    if (func.argList.length < 2) {
        throw new Error(`func ${func.kebab}: expected at least (def, ugen-rate)`);
    }
    const bodyArgs = func.argList.slice(2);
    if (registryArgs.length !== bodyArgs.length) {
        throw new Error(
            `func ${func.kebab} (${pascal}): WIT has ${bodyArgs.length} args ` +
            `but registry has ${registryArgs.length} defaults`
        );
    }

    const recordKebab = `${func.kebab.replace(/^%/, "")}-args`;
    const recordPascal = kebabToUpperCamel(recordKebab);

    const fields = [];
    const rustUnpack = []; // lines of let-bindings
    const inputPieces = []; // { kind: "single"|"list", code }
    let numOutputsExpr = null;

    for (let i = 0; i < bodyArgs.length; i++) {
        const a = bodyArgs[i];
        const reg = registryArgs[i];
        const hasDefault = reg.default !== null && reg.default !== undefined;
        const fieldRawName = a.rawName; // preserves `%in`, `%list`, `%out`
        const fieldBareName = a.name;
        const rustFieldName = escapeRustIdent(kebabToSnake(fieldBareName));

        if (a.type === "ugen-input") {
            const witFieldType = hasDefault ? "option<ugen-input>" : "ugen-input";
            fields.push({ raw: fieldRawName, type: witFieldType });
            if (hasDefault) {
                rustUnpack.push(
                    `        let ${rustFieldName} = args.${rustFieldName}`
                    + `.map(ugen_input_from_wit)`
                    + `.unwrap_or(UGenInput::Constant(${formatF32(reg.default)}));`
                );
                inputPieces.push({ kind: "single", code: rustFieldName });
            } else {
                rustUnpack.push(
                    `        let ${rustFieldName} = ugen_input_from_wit(args.${rustFieldName});`
                );
                inputPieces.push({ kind: "single", code: rustFieldName });
            }
        } else if (a.type === "list<ugen-input>") {
            fields.push({ raw: fieldRawName, type: "list<ugen-input>" });
            rustUnpack.push(
                `        let ${rustFieldName}: Vec<UGenInput> = args.${rustFieldName}`
                + `.into_iter().map(ugen_input_from_wit).collect();`
            );
            inputPieces.push({ kind: "list", code: rustFieldName });
        } else if (a.type === "u32" && a.name === "num-channels") {
            if (hasDefault) {
                fields.push({ raw: fieldRawName, type: "option<u32>" });
                const defaultInt = Math.trunc(reg.default);
                rustUnpack.push(
                    `        let ${rustFieldName} = args.${rustFieldName}.unwrap_or(${defaultInt});`
                );
            } else {
                fields.push({ raw: fieldRawName, type: "u32" });
                rustUnpack.push(
                    `        let ${rustFieldName} = args.${rustFieldName};`
                );
            }
            numOutputsExpr = rustFieldName;
        } else {
            throw new Error(
                `func ${func.kebab}: unsupported arg type ${a.type} on ${a.name}`
            );
        }
    }

    const rustMethodName = escapeRustIdent(kebabToSnake(func.kebab.replace(/^%/, "")));

    return {
        kebab: func.kebab,
        recordKebab,
        recordPascal,
        pascal,
        fields,
        docLines: func.docLines,
        rustMethodName,
        rustArgsType: recordPascal,
        rustUnpack,
        inputPieces,
        numOutputsExpr,
    };
}

function formatF32(n) {
    // Produce a Rust f32 literal. JS numbers round-trip cleanly for all
    // the registry constants (they're all short decimals like 440.0, 0.5,
    // 1760.0, 0.01).
    if (!isFinite(n)) throw new Error(`non-finite default: ${n}`);
    let s = Object.is(n, -0) ? "-0.0" : String(n);
    if (!/[eE.]/.test(s)) s += ".0";
    return s;
}

// ── WIT emission ───────────────────────────────────────────────────────────
function emitWitInterface(methods) {
    // Records sorted by recordKebab, followed by funcs sorted by kebab.
    // Matches the deterministic ordering we want regardless of file
    // iteration order in parseRegistryDefaults().
    const sortedRecords = [...methods]
        .filter(m => m.fields.length > 0)
        .sort((a, b) => a.recordKebab.localeCompare(b.recordKebab));
    const sortedFuncs = [...methods].sort((a, b) =>
        a.kebab.replace(/^%/, "").localeCompare(b.kebab.replace(/^%/, ""))
    );

    const lines = [];
    lines.push("// @generated — DO NOT EDIT. Regenerate with scripts/generate_ugens_component.mjs");
    lines.push("");
    lines.push("/// Typed UGen creators — one function per bundled UGen in the");
    lines.push("/// catalogue. Each call appends a UGen node to the borrowed");
    lines.push("/// SynthDef and returns a handle that can be passed to other");
    lines.push("/// UGens as an input. Per-UGen args are bundled into");
    lines.push("/// `<name>-args` records with optional fields for every arg");
    lines.push("/// that carries a registry default.");
    lines.push("interface ugens {");
    lines.push("    use core.{rate, ugen-input, synth-def};");
    lines.push("");
    lines.push("    /// Return the full bundled UGen registry as JSON, grouped by");
    lines.push("    /// source-file category: `[[category, [entries, …]], …]`.");
    lines.push("    registry-json: func() -> string;");
    lines.push("");

    // Records block.
    for (const m of sortedRecords) {
        lines.push(`    /// Arguments for \`${m.kebab}\`.`);
        lines.push(`    record ${m.recordKebab} {`);
        for (const f of m.fields) {
            lines.push(`        ${f.raw}: ${f.type},`);
        }
        lines.push("    }");
        lines.push("");
    }

    // Funcs block.
    for (const m of sortedFuncs) {
        for (const d of m.docLines) {
            // Doc lines come with their original indentation — rewrite to
            // our 4-space indent for consistency even if the source had a
            // different amount.
            lines.push("    " + d.trim());
        }
        if (m.fields.length > 0) {
            lines.push(
                `    ${m.kebab}: func(def: borrow<synth-def>, ugen-rate: rate, args: ${m.recordKebab}) -> ugen-input;`
            );
        } else {
            lines.push(
                `    ${m.kebab}: func(def: borrow<synth-def>, ugen-rate: rate) -> ugen-input;`
            );
        }
        lines.push("");
    }

    lines.push("}");
    return lines.join("\n");
}

function writeWitFile(methods) {
    const wit = readFileSync(WIT_PATH, "utf8");
    const witLines = wit.split("\n");
    const { startIdx, endIdx } = extractUgensInterfaceSpan(witLines);

    // Walk upward from startIdx to find the attached doc comments /
    // block-leading comments for `interface ugens {` so we can rewrite
    // them too (the new block supplies its own header). The "block" we
    // rewrite starts at the first `///` or `//` line in the contiguous
    // comment run directly above `interface ugens {`, stopping on a
    // blank line.
    let replaceStart = startIdx;
    for (let i = startIdx - 1; i >= 0; i--) {
        const l = witLines[i];
        if (/^\s*\/\//.test(l)) replaceStart = i;
        else break;
    }

    const newBlock = emitWitInterface(methods);
    const before = witLines.slice(0, replaceStart);
    const after = witLines.slice(endIdx + 1);
    const rebuilt = [...before, ...newBlock.split("\n"), ...after].join("\n");
    writeFileSync(WIT_PATH, rebuilt);

    // Return the line span we replaced and the new span's length for
    // reporting. 1-based inclusive.
    const oldStartLine = replaceStart + 1;
    const oldEndLine = endIdx + 1;
    const newStartLine = replaceStart + 1;
    const newBlockLines = newBlock.split("\n").length;
    const newEndLine = newStartLine + newBlockLines - 1;
    return { oldStartLine, oldEndLine, newStartLine, newEndLine };
}

// ── Rust emission ──────────────────────────────────────────────────────────
function emitRust(methods) {
    const sortedFuncs = [...methods].sort((a, b) =>
        a.kebab.replace(/^%/, "").localeCompare(b.kebab.replace(/^%/, ""))
    );

    // Build the list of record types we need to pull in via `use` so
    // each method signature can reference them unqualified.
    const recordTypes = [...new Set(
        sortedFuncs.filter(m => m.fields.length > 0).map(m => m.recordPascal)
    )].sort();

    const lines = [];
    lines.push("// @generated — DO NOT EDIT. Regenerate with scripts/generate_ugens_component.mjs");
    lines.push("//");
    lines.push("// Implements the typed `ugens` WIT interface. Each method receives");
    lines.push("// a per-UGen args record, unpacks it (applying registry defaults");
    lines.push("// for optional fields), and delegates to `SynthDef::add_ugen` via");
    lines.push("// the shared `delegate_ugen` helper. The canonical PascalCase");
    lines.push("// class name for each UGen is baked in at generation time,");
    lines.push("// pulled from the `pub struct` declarations under src/builders/.");
    lines.push("");
    lines.push("#![allow(warnings)]");
    lines.push("");
    lines.push("use super::bindings;");
    lines.push("use super::bindings::exports::scsynthdef::compiler::ugens::{");
    lines.push("    Guest as UgensGuest, Rate as WitRate,");
    lines.push("    SynthDefBorrow, UgenInput as WitUgenInput,");
    // Pull each args record into scope in a stable order.
    for (const r of recordTypes) {
        lines.push(`    ${r},`);
    }
    lines.push("};");
    lines.push(
        "use super::{Component, SynthDefResource, rate_from_wit, ugen_input_from_wit, ugen_input_to_wit};"
    );
    lines.push("use crate::UGenInput;");
    lines.push("");
    lines.push("/// Shared body for every typed ugen shim. Appends a UGen node to the");
    lines.push("/// borrowed SynthDef and returns its synth-index wrapped as a");
    lines.push("/// `UgenInput::Ugen(...)`. `num_outputs` defaults to the value from");
    lines.push("/// the bundled registry for the given class, unless a caller has");
    lines.push("/// passed an explicit override (for `num-channels` UGens).");
    lines.push("fn delegate_ugen(");
    lines.push("    def: SynthDefBorrow<'_>,");
    lines.push("    class_name: &'static str,");
    lines.push("    ugen_rate: WitRate,");
    lines.push("    inputs: Vec<UGenInput>,");
    lines.push("    num_outputs_override: Option<u32>,");
    lines.push(") -> WitUgenInput {");
    lines.push("    let num_outputs = num_outputs_override.unwrap_or_else(|| {");
    lines.push("        crate::registry::lookup_ugen(class_name)");
    lines.push("            .and_then(|e| e.num_outputs)");
    lines.push("            .unwrap_or(1)");
    lines.push("    });");
    lines.push("    let idx = def.get::<SynthDefResource>().inner.borrow_mut().add_ugen(");
    lines.push("        class_name,");
    lines.push("        rate_from_wit(ugen_rate),");
    lines.push("        inputs,");
    lines.push("        num_outputs,");
    lines.push("        0,");
    lines.push("    );");
    lines.push("    WitUgenInput::Ugen(idx)");
    lines.push("}");
    lines.push("");
    lines.push("impl UgensGuest for Component {");
    lines.push("    fn registry_json() -> String {");
    lines.push("        let grouped: Vec<(String, Vec<&_>)> = crate::registry::ugens_by_category()");
    lines.push("            .iter()");
    lines.push("            .map(|(cat, slice)| (cat.to_string(), slice.iter().collect()))");
    lines.push("            .collect();");
    lines.push("        serde_json::to_string(&grouped)");
    lines.push("            .unwrap_or_else(|e| format!(r#\"{{\"error\":\"{}\"}}\"#, e))");
    lines.push("    }");
    lines.push("");

    for (const m of sortedFuncs) {
        const sigParams = ["def: SynthDefBorrow<'_>", "ugen_rate: WitRate"];
        if (m.fields.length > 0) sigParams.push(`args: ${m.rustArgsType}`);
        lines.push(`    fn ${m.rustMethodName}(${sigParams.join(", ")}) -> WitUgenInput {`);

        for (const u of m.rustUnpack) lines.push(u);

        // Build the inputs vec.
        const hasList = m.inputPieces.some(e => e.kind === "list");
        if (m.inputPieces.length === 0) {
            lines.push("        let inputs: Vec<UGenInput> = Vec::new();");
        } else if (!hasList) {
            const parts = m.inputPieces.map(e => e.code).join(", ");
            lines.push(`        let inputs: Vec<UGenInput> = vec![${parts}];`);
        } else {
            // Mixed list / single pieces — build Vec imperatively,
            // extending with list fields (already Vec<UGenInput>) and
            // pushing single fields (already UGenInput).
            lines.push("        let mut inputs: Vec<UGenInput> = Vec::new();");
            for (const e of m.inputPieces) {
                if (e.kind === "single") {
                    lines.push(`        inputs.push(${e.code});`);
                } else {
                    lines.push(`        inputs.extend(${e.code});`);
                }
            }
        }

        const numOuts = m.numOutputsExpr ? `Some(${m.numOutputsExpr})` : "None";
        lines.push(
            `        delegate_ugen(def, "${m.pascal}", ugen_rate, inputs, ${numOuts})`
        );
        lines.push("    }");
        lines.push("");
    }
    lines.push("}");
    lines.push("");
    writeFileSync(OUT_PATH, lines.join("\n"));
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
    const wit = readFileSync(WIT_PATH, "utf8");
    const witLines = wit.split("\n");
    const { startIdx, endIdx } = extractUgensInterfaceSpan(witLines);
    const funcs = parseCurrentUgensFuncs(witLines, startIdx, endIdx)
        .filter(f => f.kebab !== "registry-json");

    const pascalNames = collectPascalNames();
    const normToPascal = buildKebabToPascal(pascalNames);
    const registryByPascal = parseRegistryDefaults();

    const methods = [];
    const unmatched = [];
    const missingDefaults = [];
    for (const f of funcs) {
        const norm = normalizeKebab(f.kebab);
        const pascal = normToPascal.get(norm);
        if (!pascal) { unmatched.push(f.kebab); continue; }
        const regArgs = registryByPascal.get(pascal);
        if (!regArgs) { missingDefaults.push(pascal); continue; }
        methods.push(synthesize(f, pascal, regArgs));
    }
    if (unmatched.length) {
        console.error(`fatal: ${unmatched.length} WIT kebab(s) with no builder struct:`);
        for (const u of unmatched) console.error(`  ${u}`);
        process.exit(1);
    }
    if (missingDefaults.length) {
        console.error(`fatal: ${missingDefaults.length} Pascal name(s) missing from registry:`);
        for (const p of missingDefaults) console.error(`  ${p}`);
        process.exit(1);
    }

    const span = writeWitFile(methods);
    emitRust(methods);

    const requiredFieldUgens = methods.filter(m =>
        m.fields.some(f => !f.type.startsWith("option<") && f.type !== "list<ugen-input>"
            || f.type === "list<ugen-input>" // variadics are required but we still count UGens with *any* non-optional scalar
        )
    );
    // More precise: UGens with at least one required ugen-input / u32 field
    // (i.e. any field whose type isn't wrapped in `option<…>`). List fields
    // are always required but are a distinct category; count "required
    // scalar" UGens separately.
    const reqScalarCount = methods.filter(m =>
        m.fields.some(f => f.type === "ugen-input" || f.type === "u32")
    ).length;

    console.log(
        `regenerated ${methods.length} ugens → ${OUT_PATH}\n` +
        `WIT rewrite: lines ${span.oldStartLine}..${span.oldEndLine} → ${span.newStartLine}..${span.newEndLine}\n` +
        `records emitted: ${methods.filter(m => m.fields.length > 0).length}\n` +
        `UGens with ≥1 required field (no default): ${reqScalarCount}`
    );
}

main();
