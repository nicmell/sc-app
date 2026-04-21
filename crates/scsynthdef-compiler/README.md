# scsynthdef-compiler

Spec-only Rust library for the SuperCollider SynthDef File Format v2
([spec](https://doc.sccode.org/Reference/Synth-Definition-File-Format.html)).
Compiles `.scsyndef` bytes that scsynth accepts, and parses them back.

## Layers

- **`SynthDef`** — the builder / reader. `to_bytes` / `from_bytes` /
  `to_json` / `from_json` cover the four round-trip entry points.
- **`builders::*`** — a typed struct per bundled UGen (~365 total),
  generated from `src/assets/ugens/*.json` (the curated catalogue). Each
  struct exposes `ar()` / `kr()` / `ir()` constructors (only those rates
  the UGen supports), setter methods per arg (with rustdoc from the
  source catalogue), and `build(&mut SynthDef) -> UGenInput`.
- **`registry::lookup_ugen` + `ugens_by_category`** — metadata access
  for documentation browsers and generators.

## Build targets

### Native Rust

```bash
cargo build -p scsynthdef-compiler
cargo test  -p scsynthdef-compiler
```

### `wasm32` + wasm-bindgen (current frontend path)

```bash
cargo build -p scsynthdef-compiler \
    --features wasm \
    --target wasm32-unknown-unknown \
    --release
```

The `wasm` Cargo feature gates `#[wasm_bindgen]` exports. Today that's
`ugenRegistryJson` — used by
`examples/frontend/` to render the bundled UGen docs in a browser.
`examples/frontend/package.json::build:wasm` runs `wasm-pack` against
this target and post-copies the resulting `pkg/` next to the HTML page.

### WIT + Component Model (future / experimental)

`wit/scsynthdef.wit` is the canonical interface definition for the
crate — generated from the same curated catalogue by
`scripts/generate_wit.mjs` and validated with `wasm-tools component
wit`. It describes:

- `interface core` — `rate`, `ugen-input`, the `synth-def` resource,
  and `parse-scgf`.
- `interface ugens` — one `func` per bundled UGen.
- `world scsynthdef` — exports both interfaces.

Consumers who can target the WebAssembly Component Model (Rust via
`cargo-component`, JS via `@bytecodealliance/jco`, …) should treat this
file as the source of truth. A future migration of
`examples/frontend/` from `wasm-bindgen` to `jco`-generated bindings is
tracked as follow-up work — the Rust-side `wit-bindgen` implementation
is non-trivial (365 UGen functions to wire up to the typed builders)
and we've deferred it rather than risk a half-finished toolchain swap.

## Regeneration

```bash
# 1. Refresh the catalogue from Overtone (rare, network fetch):
node scripts/generate_ugen_db.mjs

# 2. Regenerate the Rust registry + typed builders:
node scripts/generate_ugens_rust.mjs

# 3. Regenerate the WIT interface:
node scripts/generate_wit.mjs
```

`src/ugens/*.rs` (registry data) and `src/builders/*.rs` (typed
builders) and `wit/scsynthdef.wit` are all generated artifacts.
Edit the JSON catalogue, then re-run steps 2 and 3.
