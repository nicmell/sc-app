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

## Usage

### From Rust — typed `builders::*` API

Each UGen is a generated struct with `ar()` / `kr()` / `ir()`
constructors (only the rates SC actually supports), typed setter
methods per arg, and a terminal `.build(&mut SynthDef) -> UGenInput`
that appends the UGen to the graph and returns a handle usable as
another UGen's input.

```rust
use scsynthdef_compiler::builders::{Out, SinOsc};
use scsynthdef_compiler::{Rate, SynthDef};

let mut def = SynthDef::new("sine");

// Add a kr control — it returns a UGenInput handle.
let freq = def.add_control("freq", 440.0, Rate::Control)?;

// Build the graph. Each `.build` appends the UGen and returns the
// handle you feed into the next one. Constants are passed unwrapped
// — the setters take `impl Into<UGenInput>`.
let osc = SinOsc::ar().freq(freq).phase(0.0).build(&mut def);
Out::ar().bus(0.0).channels_array([osc]).build(&mut def);

// `.scsyndef` bytes — send via `/d_recv` or write to disk.
let bytes = def.to_bytes()?;
# Ok::<(), scsynthdef_compiler::SynthDefError>(())
```

Round-trip a compiled binary back into a `SynthDef` for inspection:

```rust
use scsynthdef_compiler::SynthDef;

let def = SynthDef::from_bytes(&bytes)?;
let json = def.to_json()?;          // for diffs / debugging
let back = SynthDef::from_json(&json)?;
```

Introspect the bundled UGen catalogue (365 UGens shipped):

```rust
use scsynthdef_compiler::registry::{lookup_ugen, ugens_by_category};

let spec = lookup_ugen("SinOsc").unwrap();
println!("{}: {} inputs, {} outputs",
    spec.name, spec.inputs.len(), spec.outputs);

for (category, ugens) in ugens_by_category() {
    println!("{category}: {} ugens", ugens.len());
}
```

### From TypeScript (WASM component)

The WIT `core` interface exports a `SynthDef` resource mirroring the
Rust builder, plus stringly-typed `addUgen` / `addControl` methods
(the typed `ugens` interface is declared but not exported — see
"WIT surface" below).

```ts
import { core } from './pkg/scsynthdef_compiler.js';
import type { UgenInput } from './pkg/interfaces/scsynthdef-compiler-core.js';

// Helpers to build UgenInput variants for addUgen's inputs array.
const k = (v: number): UgenInput => ({ tag: 'constant', val: v });
const u = (i: number): UgenInput => ({ tag: 'ugen',     val: i });

const def = new core.SynthDef('sine');

// addControl returns a UgenInput handle you can feed to addUgen.
const freq = def.addControl('freq', 440, 'control');

// addUgen(name, rate, inputs, numOutputs, specialIndex) → graph index.
// Wrap that index in `u(...)` to reference it from a later UGen.
const osc = def.addUgen('SinOsc', 'audio', [freq, k(0)], 1, 0);
def.addUgen('Out',    'audio', [k(0), u(osc)],           0, 0);

const bytes = def.toBytes();

// Inspect / diff.
const json = def.toJson();
const parsed = core.parseScgf(bytes);           // JSON from bytes
const registry = JSON.parse(core.registryJson()); // catalogue for UI
```

See `examples/node/sclang_parity.ts` for the full three-fixture
harness that byte-diffs against `sclang`.

## Build targets

### Native Rust

```bash
cargo build -p scsynthdef-compiler
cargo test  -p scsynthdef-compiler
cargo run   -p scsynthdef-compiler --example sclang_parity
```

`examples/sclang_parity.rs` builds three fixtures (`sine`,
`sc_test_recorder`, `global_clock_phase`) via the typed `builders::*`
API and byte-diffs the output against `sclang`'s compiler.

### WebAssembly Component + TypeScript bindings

The component path is the canonical way to use the crate from JS/TS.
`wit/scsynthdef.wit` is the source of truth for the interface.

Toolchain: `cargo install cargo-component` + `npm install -D
@bytecodealliance/jco`. Then:

```bash
cd crates/scsynthdef-compiler
cargo component build --release --features component --target wasm32-wasip1
jco transpile target/wasm32-wasip1/release/scsynthdef_compiler.wasm -o pkg
```

The `component` feature pulls in `wit-bindgen-rt`; `src/component.rs`
implements the WIT `core` interface — the `synth-def` resource
(constructor + `name` / `add-control` / `add-ugen` / `to-bytes` /
`to-json`), `parse-scgf`, and `registry-json`. `jco transpile`
produces a self-contained ESM package with TypeScript declarations.

Two examples consume the component:

- **`examples/frontend/`** — browser docs page (Vite + jco). Imports
  `core.registryJson()` and renders every bundled UGen.
  `npm run build:wasm` drives the full `cargo component build` + `jco
  transpile` pipeline; `npm run dev` serves the page.

- **`examples/node/`** — Node `sclang_parity.ts`. Mirrors the Rust
  harness: builds the same three fixtures via the `core.SynthDef`
  resource's `addControl` / `addUgen` methods, runs sclang on each
  fixture's `.scd`, byte-diffs the output. `npm run build:component`
  compiles + transpiles; `npm run parity` runs the harness.

### WIT surface (current)

- `interface core` — exported. `rate` enum, `ugen-input` variant,
  `synth-def` resource, `parse-scgf`, `registry-json`.
- `interface ugens` — defined as a reference surface but **not
  exported** from the `scsynthdef` world. It lists one typed `func` per
  bundled UGen (`sin-osc`, `out`, `in`, `buf-wr`, …) — wiring the
  Guest-side impls up to the existing `builders::*` structs is
  tracked as follow-up work. The stringly-typed `core.synth-def`
  methods cover the same byte output today and are what both examples
  use.

## Regeneration

```bash
# 1. Refresh the catalogue from Overtone (rare, network fetch):
node scripts/generate_ugen_db.mjs

# 2. Regenerate the Rust registry + typed builders:
node scripts/generate_ugens_rust.mjs

# 3. Regenerate the WIT interface:
node scripts/generate_wit.mjs
```

`src/specs/*.rs` (registry data), `src/builders/*.rs` (typed
builders), and `wit/scsynthdef.wit` are all generated artifacts —
edit the JSON catalogue, then re-run steps 2 and 3.

`src/bindings.rs` is emitted on demand by `cargo component bindings`
/ `cargo component build` and is gitignored.
