#!/usr/bin/env node
// Generate src/ugens_component.rs from wit/scsynthdef.wit + src/builders/*.rs.
//
// For each `interface ugens { ... }` typed UGen declaration we emit a Rust
// method on `impl bindings::exports::scsynthdef::compiler::ugens::Guest for
// Component`. Methods delegate to `SynthDef::add_ugen` with the canonical
// SuperCollider PascalCase class name pulled from the matching `pub struct`
// in src/builders/*.rs.
//
// Zero deps beyond node-builtins. Run from the crate root:
//   node scripts/generate_ugens_component.mjs

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRATE_ROOT = join(__dirname, "..");
const WIT_PATH = join(CRATE_ROOT, "wit", "scsynthdef.wit");
const BUILDERS_DIR = join(CRATE_ROOT, "src", "builders");
const OUT_PATH = join(CRATE_ROOT, "src", "ugens_component.rs");

// ── Rust keyword list (2021 edition + reserved) ────────────────────────────
// wit-bindgen-rust appends `_` to any arg/method name that collides with a
// Rust keyword. We mirror that here so the generated fn/arg names line up
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
    // wit-bindgen's kebab→snake is just dash→underscore for our subset
    // (no camelCase in WIT kebab names).
    return k.replace(/-/g, "_");
}

// ── Pascal→kebab (heck ToKebabCase compatible) ─────────────────────────────
// Mirror heck 0.5's algorithm. We only need it for the builder struct
// names (PascalCase / ALL_CAPS / digits). Test cases covered by the
// final matching pass against the WIT kebab names.
function pascalToKebabHeck(s) {
    if (!s) return s;
    const chars = [...s];
    const isUpper = c => c >= "A" && c <= "Z";
    const isLower = c => c >= "a" && c <= "z";
    const isDigit = c => c >= "0" && c <= "9";
    const isLetter = c => isUpper(c) || isLower(c);
    const out = [];
    for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        const prev = chars[i - 1];
        const next = chars[i + 1];
        if (i > 0) {
            // boundary rules (heck semantics):
            // - lowercase/digit → upper: boundary
            // - upper → upper when next is lower: boundary (acronym break,
            //   e.g. XMLParser → xml-parser)
            // - letter → digit: NO boundary (A2K → a2k, not a-2-k)
            // - digit → letter: NO boundary (A2K → a2k)
            if ((isLower(prev) || isDigit(prev)) && isUpper(c)) {
                out.push("-");
            } else if (
                isUpper(prev) && isUpper(c) && next && isLower(next)
            ) {
                out.push("-");
            }
        }
        if (c === "_") {
            // PV_MagSquared → pv-mag-squared: underscore is a boundary
            if (out.length && out[out.length - 1] !== "-") out.push("-");
        } else {
            out.push(c.toLowerCase());
        }
    }
    // collapse any accidental doubled dashes
    return out.join("").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function normalizeKebab(k) {
    // Strip leading `%`, strip all `-` for lookup. The WIT generator occasionally
    // inserts a dash around digits that heck omits (e.g. `a2-k` vs heck's `a2k`);
    // dash-stripping normalises both forms.
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
    // Map normalized-kebab → Pascal. Detect collisions (should not happen
    // for the SC catalogue).
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

// ── WIT parser ─────────────────────────────────────────────────────────────
// Extract the `interface ugens { ... }` body, drop doc comments, then
// parse each `func(...)` declaration.
function extractUgensInterface(wit) {
    // WIT formatting in this file is column-strict: the opening
    // `interface ugens {` sits at column 0, every body line is indented, and
    // the closing `}` also sits at column 0. That avoids having to parse
    // every brace we see inside doc comments (`/// #{ … }`) and
    // `use core.{…};` statements.
    const lines = wit.split("\n");
    let start = -1;
    const body = [];
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (start < 0) {
            if (/^interface\s+ugens\s*\{/.test(l)) {
                start = i;
            }
        } else {
            if (/^\}\s*$/.test(l)) return body.join("\n");
            body.push(l);
        }
    }
    throw new Error("could not find `interface ugens { ... }` block in WIT");
}

// Parse all `name: func(args) -> ret;` declarations. Returns an array of
// { kebab, argList } where argList is an array of { name, type, rawName }.
function parseFuncs(body) {
    // Remove line comments (`// ...`) so they don't trip up the regex.
    const stripped = body
        .split("\n")
        .map(l => l.replace(/\/\/.*$/, ""))
        .join("\n");
    const funcs = [];
    // Match:   (optional %) kebab-name : func ( ... ) -> return-type ;
    const re =
        /(?:^|\n)\s*(%?[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*func\s*\(([^)]*)\)\s*->\s*([^;]+);/g;
    let m;
    while ((m = re.exec(stripped)) !== null) {
        const kebab = m[1];
        const argsStr = m[2].trim();
        const ret = m[3].trim();
        const argList = [];
        if (argsStr.length > 0) {
            // Split on commas that are NOT inside `<...>` (nested generics).
            const parts = splitTopLevelCommas(argsStr);
            for (const p of parts) {
                const mm = p.trim().match(/^(%?[a-zA-Z][a-zA-Z0-9-]*)\s*:\s*(.+)$/);
                if (!mm) throw new Error(`unparseable arg: ${p}`);
                argList.push({
                    rawName: mm[1],
                    name: mm[1].replace(/^%/, ""),
                    type: mm[2].trim(),
                });
            }
        }
        funcs.push({ kebab, argList, returnType: ret });
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

// ── Rust signature synthesis ───────────────────────────────────────────────
// Given a parsed WIT func declaration, produce:
//   - rustMethodName: snake_case of the kebab, escaped if keyword
//   - argDecls: [{ rustName, rustType }]
//   - callBody: Rust code string that builds the `inputs` Vec and computes
//     `num_outputs`, then invokes `delegate_ugen`.
function synthesizeRust(func, pascal) {
    // Drop leading `def: borrow<synth-def>` and `ugen-rate: rate`. Those are
    // fixed-position leading args — we handle them in the method head.
    const args = func.argList.slice(2); // [2..] are the UGen-specific args
    if (func.argList.length < 2) {
        throw new Error(`func ${func.kebab}: expected at least (def, ugen-rate)`);
    }

    const rustMethodBase = kebabToSnake(func.kebab.replace(/^%/, ""));
    const rustMethodName = escapeRustIdent(rustMethodBase);

    // Build parameter declarations and the body pieces.
    const paramDecls = [];
    const inputExprs = []; // each element is Rust code producing UGenInput or extending Vec
    let numOutputsExpr = null; // set iff func has a `num-channels: u32` arg

    for (const a of args) {
        const rustArgBase = kebabToSnake(a.name);
        const rustArg = escapeRustIdent(rustArgBase);
        if (a.type === "ugen-input") {
            paramDecls.push(`${rustArg}: WitUgenInput`);
            inputExprs.push({ kind: "single", code: `ugen_input_from_wit(${rustArg})` });
        } else if (a.type === "list<ugen-input>") {
            paramDecls.push(`${rustArg}: Vec<WitUgenInput>`);
            inputExprs.push({ kind: "list", code: rustArg });
        } else if (a.type === "u32" && a.name === "num-channels") {
            paramDecls.push(`${rustArg}: u32`);
            numOutputsExpr = rustArg;
        } else {
            throw new Error(
                `func ${func.kebab}: unsupported arg type ${a.type} on ${a.name}`
            );
        }
    }

    return {
        rustMethodName,
        paramDecls,
        inputExprs,
        numOutputsExpr,
        pascal,
    };
}

// ── Emission ───────────────────────────────────────────────────────────────
function emit(outPath, methods) {
    const lines = [];
    lines.push(
        "// @generated — DO NOT EDIT. Regenerate via scripts/generate_ugens_component.mjs"
    );
    lines.push("//");
    lines.push("// Implements the typed `ugens` WIT interface. Each method is a thin");
    lines.push("// shim that appends a UGen node to the borrowed SynthDef via the");
    lines.push("// shared `delegate_ugen` helper. The canonical PascalCase class name");
    lines.push("// for each UGen is baked in at generation time, pulled from the");
    lines.push("// `pub struct` declarations under src/builders/.");
    lines.push("");
    lines.push("#![allow(warnings)]");
    lines.push("");
    lines.push("use super::bindings;");
    lines.push("use super::bindings::exports::scsynthdef::compiler::ugens::{");
    lines.push("    Guest as UgensGuest, Rate as WitRate,");
    lines.push("    SynthDefBorrow, UgenInput as WitUgenInput,");
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
    lines.push(
        "            .unwrap_or_else(|e| format!(r#\"{{\"error\":\"{}\"}}\"#, e))"
    );
    lines.push("    }");
    lines.push("");

    for (const m of methods) {
        const params = [
            "def: SynthDefBorrow<'_>",
            "ugen_rate: WitRate",
            ...m.paramDecls,
        ];
        lines.push(`    fn ${m.rustMethodName}(${params.join(", ")}) -> WitUgenInput {`);

        // Build the inputs vec.
        const hasList = m.inputExprs.some(e => e.kind === "list");
        if (m.inputExprs.length === 0) {
            lines.push("        let inputs: Vec<UGenInput> = Vec::new();");
        } else if (!hasList) {
            const parts = m.inputExprs.map(e => e.code).join(", ");
            lines.push(`        let inputs: Vec<UGenInput> = vec![${parts}];`);
        } else {
            lines.push("        let mut inputs: Vec<UGenInput> = Vec::new();");
            for (const e of m.inputExprs) {
                if (e.kind === "single") {
                    lines.push(`        inputs.push(${e.code});`);
                } else {
                    // list<ugen-input>: drain the Vec and convert each element
                    lines.push(
                        `        inputs.extend(${e.code}.into_iter().map(ugen_input_from_wit));`
                    );
                }
            }
        }
        const numOutsArg = m.numOutputsExpr
            ? `Some(${m.numOutputsExpr})`
            : "None";
        lines.push(
            `        delegate_ugen(def, "${m.pascal}", ugen_rate, inputs, ${numOutsArg})`
        );
        lines.push("    }");
        lines.push("");
    }
    lines.push("}");
    lines.push("");

    writeFileSync(outPath, lines.join("\n"));
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
    const wit = readFileSync(WIT_PATH, "utf8");
    const body = extractUgensInterface(wit);
    const funcs = parseFuncs(body);

    const pascalNames = collectPascalNames();
    const normToPascal = buildKebabToPascal(pascalNames);

    const ugenFuncs = funcs.filter(f => f.kebab !== "registry-json");
    const methods = [];
    const unmatched = [];

    for (const f of ugenFuncs) {
        const norm = normalizeKebab(f.kebab);
        const pascal = normToPascal.get(norm);
        if (!pascal) {
            unmatched.push(f.kebab);
            continue;
        }
        methods.push(synthesizeRust(f, pascal));
    }

    if (unmatched.length) {
        console.error(
            `fatal: ${unmatched.length} WIT kebab name(s) have no matching builder struct:`
        );
        for (const u of unmatched) console.error(`  ${u}`);
        process.exit(1);
    }

    // Also check we have a `registry-json` entry to handle; our emitter
    // hard-codes it, but sanity-check the input.
    if (!funcs.some(f => f.kebab === "registry-json")) {
        console.error(
            "warning: `registry-json` func not found in ugens interface; emitted impl anyway"
        );
    }

    emit(OUT_PATH, methods);
    console.log(`generated ${methods.length} ugen impls → ${OUT_PATH}`);
}

main();
