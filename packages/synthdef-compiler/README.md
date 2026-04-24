# @sc-app/synthdef-compiler

Pure TypeScript port of `crates/scsynthdef-compiler`. Compiles `.scsyndef`
bytes in the [SuperCollider SynthDef File Format v2][spec] that scsynth
accepts, and parses them back. Byte-for-byte identical output to sclang's
compiler for every bundled UGen.

[spec]: https://doc.sccode.org/Reference/Synth-Definition-File-Format.html

## Layers

- **`SynthDef`** — the builder / reader. `toBytes` / `fromBytes` /
  `toJson` / `fromJson` cover the four round-trip entry points.
- **`builders/*`** — a typed class per bundled UGen (365 total),
  generated from the Rust crate's builder sources. Each class exposes
  `ar()` / `kr()` / `ir()` static constructors (only those rates the
  UGen supports), setter methods per arg (with JSDoc from the source
  catalogue), and `build(def): UGenInput`.
- **`lookupUgen` + `ugensByCategory`** — registry access for
  documentation browsers.

## Usage

```ts
import { SynthDef } from '@sc-app/synthdef-compiler';
import { Out, SinOsc } from '@sc-app/synthdef-compiler/builders';

const def = new SynthDef('sine');

// Add a kr control — returns a UGenInput handle.
const freq = def.addControl('freq', 440, 'control');

// Build the graph. Each `.build(def)` appends the UGen and returns the
// handle you feed into the next one. Constants are passed unwrapped —
// setters accept `number | UGenInput`.
const osc = SinOsc.ar().freq(freq).phase(0).build(def);
Out.ar().bus(0).channelsArray([osc]).build(def);

// `.scsyndef` bytes — send via `/d_recv` or write to disk.
const bytes = def.toBytes();
```

Round-trip a compiled binary back into a `SynthDef` for inspection:

```ts
import { SynthDef } from '@sc-app/synthdef-compiler';

const def = SynthDef.fromBytes(bytes);
const json = def.toJson();          // for diffs / debugging
const back = SynthDef.fromJson(json);
```

Introspect the bundled UGen catalogue (365 UGens shipped):

```ts
import { lookupUgen, ugensByCategory } from '@sc-app/synthdef-compiler';

const spec = lookupUgen('SinOsc');
console.log(`${spec!.name}: ${spec!.defaults.length} inputs`);

for (const [category, ugens] of ugensByCategory()) {
  console.log(`${category}: ${ugens.length} ugens`);
}
```

For callers who prefer the string-addressable low-level API, `SynthDef`
also exposes `addUgen(className, rate, inputs, numOutputs, specialIndex)`
and `addControl(name, default, rate)` directly.

## Tests

```bash
yarn workspace @sc-app/synthdef-compiler test
```

22 tests cover: low-level builder, typed-builder parity with low-level
path, JSON round-trip, SCgf byte round-trip, operator tables, registry
invariants, and three fixture graphs (`sine`, `sc_test_recorder`,
`global_clock_phase`) that mirror the Rust crate's parity harness.

## sclang parity

If sclang is on `$PATH`, the parity harness runs the same three fixtures
through sclang and byte-diffs the result:

```bash
yarn workspace @sc-app/synthdef-compiler parity
```

Equivalent to `cargo run --example sclang_parity` in the Rust crate.

## Regeneration

`src/specs/*.ts` and `src/builders/*.ts` are generated from the Rust
crate's sources. To refresh them after a Rust-side catalogue update:

```bash
yarn workspace @sc-app/synthdef-compiler generate
```

The scripts under `scripts/` parse
`crates/scsynthdef-compiler/src/{specs,builders}/*.rs` and emit matching
TypeScript. No runtime dependency on the Rust crate.
