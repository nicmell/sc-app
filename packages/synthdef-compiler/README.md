# @sc-app/synthdef-compiler

Pure TypeScript SynthDef compiler for
[SuperCollider](https://supercollider.github.io/). Emits the
[SynthDef File Format v2][spec] binary that `scsynth` accepts, parses
it back, and ships a typed builder per bundled UGen. Byte-identical
output to `sclang`'s own compiler for every fixture in the test suite.

[spec]: https://doc.sccode.org/Reference/Synth-Definition-File-Format.html

## Install

Workspace-local — referenced from the host app via
`"@sc-app/synthdef-compiler": "workspace:*"`.

## Three API layers

- **`synthdef(name, fn)`** — sclang-style callback form (recommended).
- **`SynthDef` + `builders/*`** — typed chainable builders, one class
  per bundled UGen (365 shipped).
- **`SynthDef.addControl` / `addUgen`** — low-level stringly-typed
  API for programmatic graph construction.

All three produce the same SCgf v2 bytes.

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

### Round-trip / inspection

```ts
import { SynthDef } from '@sc-app/synthdef-compiler';

const def = SynthDef.fromBytes(bytes);
const json = def.toJson();          // for diffs / debugging
const back = SynthDef.fromJson(json);
```

### UGen catalogue access

```ts
import { lookupUgen, ugensByCategory } from '@sc-app/synthdef-compiler';

const spec = lookupUgen('SinOsc');
console.log(`${spec!.name}: ${spec!.defaults.length} inputs`);

for (const [category, ugens] of ugensByCategory()) {
  console.log(`${category}: ${ugens.length} ugens`);
}
```

For callers who prefer the stringly-typed low-level API, `SynthDef`
exposes `addUgen(className, rate, inputs, numOutputs, specialIndex)`
and `addControl(name, default, rate)` directly.

## Tests

```bash
yarn workspace @sc-app/synthdef-compiler test
```

Tests cover: low-level builder, typed-builder parity with the
low-level path, JSON round-trip, SCgf byte round-trip, operator
tables, registry invariants, `fn.toString()` parser edge cases,
`synthdef()` sugar byte parity, control-rate wrappers, operator
helpers, and three fixture graphs (`sine`, `sc_test_recorder`,
`global_clock_phase`).

## sclang parity

If sclang is on `$PATH`, the parity harness runs the three fixtures
through sclang and byte-diffs the result:

```bash
yarn workspace @sc-app/synthdef-compiler parity
```

Skips cleanly if sclang isn't installed.
