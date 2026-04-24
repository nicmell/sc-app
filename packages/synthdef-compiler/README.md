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

### sclang-style callback (recommended)

```ts
import { synthdef, ar } from '@sc-app/synthdef-compiler';

const def = synthdef('sine', (g, { freq = 440, amp = 0.5 }) => {
  const osc = g.SinOsc.ar(freq, 0);
  g.Out.ar(0, g.mul(osc, amp));
});

const bytes = def.toBytes();
```

Controls are declared by the callback's second-argument destructuring
pattern. Plain numeric defaults (`freq = 440`) are control-rate (kr);
wrap in `ar(v)` or `ir(v)` to override:

```ts
synthdef('rec', (g, { bus = 0, trig = ar(0), seed = ir(42) }) => { … });
```

Defaults are parsed from the callback source at runtime — only literal
numbers and `ar()` / `kr()` / `ir()` wrapper calls are supported;
references to outer bindings won't resolve.

The `g` namespace exposes every bundled UGen with positional `.ar()` /
`.kr()` / `.ir()` methods (arg order matches SC's declared arg order),
plus arithmetic helpers: `g.mul`, `g.add`, `g.sub`, `g.div`, `g.mod`,
`g.pow`, `g.min`, `g.max`, `g.neg`, `g.abs`, `g.reciprocal`,
`g.midicps`, `g.cpsmidi`, `g.ampdb`, `g.dbamp`.

### Typed chainable builders

```ts
import { SynthDef } from '@sc-app/synthdef-compiler';
import { Out, SinOsc } from '@sc-app/synthdef-compiler/builders';

const def = new SynthDef('sine');
const freq = def.addControl('freq', 440, 'control');
const osc = SinOsc.ar().freq(freq).phase(0).build(def);
Out.ar().bus(0).channelsArray([osc]).build(def);

const bytes = def.toBytes();
```

This lower-level API threads `def` explicitly and is the composable
primitive the sclang-style wrapper is built on top of. Use it when you
want to construct graphs programmatically outside a callback.

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

41 tests cover: low-level builder, typed-builder parity with low-level
path, JSON round-trip, SCgf byte round-trip, operator tables, registry
invariants, `fn.toString()` parser edge cases, `synthdef()` sugar byte
parity against the low-level path, control-rate wrappers, operator
helpers, and three fixture graphs (`sine`, `sc_test_recorder`,
`global_clock_phase`) that mirror the Rust crate's parity harness.

## sclang parity

If sclang is on `$PATH`, the parity harness runs the same three fixtures
through sclang and byte-diffs the result:

```bash
yarn workspace @sc-app/synthdef-compiler parity
```

Equivalent to `cargo run --example sclang_parity` in the Rust crate.

## Regeneration

`src/specs/*.ts`, `src/builders/*.ts`, and `src/sugar/graph.types.ts`
are all generated. To refresh them after a Rust-side catalogue update:

```bash
yarn workspace @sc-app/synthdef-compiler generate
```

The scripts under `scripts/` parse
`crates/scsynthdef-compiler/src/{specs,builders}/*.rs` and emit matching
TypeScript, then read the generated specs to emit the typed `Graph`
interface used by `synthdef()`. No runtime dependency on the Rust crate.
