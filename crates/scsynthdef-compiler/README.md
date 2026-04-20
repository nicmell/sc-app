# scsynthdef-compiler

A pure-Rust compiler for SuperCollider SynthDef binaries (SCgf v2) — the format
emitted by `.scsyndef` files and consumed by scsynth via `/d_recv`.

This crate is a Rust port of the TypeScript SynthDef compiler in the `sc-app`
repository. It is designed to be usable:

1. Natively from Rust (backend tools, tests, CLIs).
2. As a WebAssembly module via `wasm-pack` (to later replace the TS compiler in
   browser contexts with a single source of truth).

## Status

Early / experimental. The primary entry point is `compile_synthdef`, which
consumes an HTML-parsed UGen spec map — the same shape produced by the sc-app
plugin HTML parser.

## Two APIs

### High-level (HTML-driven)

```rust
use scsynthdef_compiler::{compile_synthdef, UGenSpec};
use std::collections::BTreeMap;

let mut params = BTreeMap::new();
params.insert("freq".to_string(), 440.0);

let mut specs = BTreeMap::new();
specs.insert("osc".into(), UGenSpec {
    name: "osc".into(),
    ugen_type: "SinOsc".into(),
    rate: "ar".into(),
    inputs: [("freq".into(), "freq".into())].into_iter().collect(),
});
specs.insert("out".into(), UGenSpec {
    name: "out".into(),
    ugen_type: "Out".into(),
    rate: "ar".into(),
    inputs: [
        ("bus".into(), "0".into()),
        ("channelsArray".into(), "osc".into()),
    ].into_iter().collect(),
});

let bytes = compile_synthdef("simpleSine", &params, &specs).unwrap();
```

### Low-level (programmatic)

```rust
use scsynthdef_compiler::{SynthDef, Rate, UGenInput};

let mut def = SynthDef::new("simpleSine");
let freq = def.add_control("freq", 440.0, Rate::Control);
let osc = def.add_ugen("SinOsc", Rate::Audio,
    vec![UGenInput::UGenRef(freq), UGenInput::Constant(0.0)], 1, 0);
def.add_ugen("Out", Rate::Audio,
    vec![UGenInput::Constant(0.0), UGenInput::UGenRef(osc)], 0, 0);
let bytes = def.to_bytes().unwrap();
```

## WASM build

```bash
wasm-pack build --target web --features wasm
```

## UGen registry

~367 UGens are bundled via embedded JSON (regenerated from Overtone metadata by
`scripts/generate_ugen_db.mjs` in the parent sc-app repo).
