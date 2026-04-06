# UGen System

SuperCollider UGen graph builder and SCgf binary encoder. Provides both a **declarative HTML API** (used by plugins) and a **programmatic JavaScript API** for building SynthDefs.

## Architecture

```
ugen.ts         UGen class, Rate enum, context stack
synthdef.ts     SynthDef class, SCgf v2 binary encoder (includes ByteWriter)
control.ts      control() for named synth parameters
operators.ts    Binary/unary op tables and helper functions
define.ts       defineUGen()/defineMultiOutUGen() factories
registry.ts     UGen spec registry — loads JSON metadata from src/assets/ugens/ on import
```

### Data flow

1. `registry.ts` imports JSON files from `src/assets/ugens/` and populates the registry on module load
2. The SynthDef compiler (`src/lib/synthdef/SynthDefCompiler.ts`) looks up UGen specs via `lookupUGen()` to resolve input order and defaults
3. The compiler builds a UGen graph using `UGen`, `control()`, and `synthDef()`, then encodes to SCgf binary

### Refreshing the UGen registry

The JSON files in `src/assets/ugens/` are auto-generated from [Overtone](https://github.com/overtone/overtone)'s metadata:

```bash
node scripts/generate_ugen_db.mjs
```

## Programmatic JavaScript API

You can build SynthDefs in TypeScript/JavaScript using `defineUGen()` and `synthDef()`:

### Basic example

```ts
import { synthDef, control, defineUGen, Rate } from '@/lib/ugen';
import { binOp } from '@/lib/ugen/operators';

// Define UGens (or use lookupUGen() from registry)
const SinOsc = defineUGen({
  name: 'SinOsc',
  rates: [Rate.Audio, Rate.Control],
  defaults: [['freq', 440], ['phase', 0]],
});

const Out = defineUGen({
  name: 'Out',
  rates: [Rate.Audio],
  defaults: [['bus', 0], ['channelsArray', undefined]],
  numOutputs: 0,
});

// Build a SynthDef
const def = synthDef('simpleSine', () => {
  const freq = control('freq', 440);
  const amp = control('amp', 0.2);
  const sig = SinOsc.ar(freq);
  const scaled = binOp('*', sig, amp);
  Out.ar(0, scaled);
});

// Get SCgf binary (send via /d_recv)
const bytes = def.toBytes();  // Uint8Array

// Or inspect as JSON
const json = def.toJson();
```

### Multi-output UGens

```ts
import { defineMultiOutUGen, Rate } from '@/lib/ugen';

const Pan2 = defineMultiOutUGen({
  name: 'Pan2',
  rates: [Rate.Audio],
  defaults: [['in', undefined], ['pos', 0], ['level', 1]],
  numOutputs: 2,
});

// Pan2.ar() returns UGenOutput[] (one per channel)
const [left, right] = Pan2.ar(sig, 0, 1);
```

### Operators

```ts
import { binOp, unaryOp, mulAdd } from '@/lib/ugen/operators';

// Binary operations (with constant folding)
const sum = binOp('+', sig1, sig2);
const product = binOp('*', sig, 0.5);

// Unary operations
const negated = unaryOp('neg', sig);
const midi = unaryOp('midicps', noteNum);

// Multiply-add optimization
const scaled = mulAdd(sig, 0.5, 0.5);  // sig * 0.5 + 0.5
```

Available binary ops: `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `min`, `max`, `pow`, `atan2`, `hypot`, `round`, `trunc`, `absdif`, `clip2`, `fold2`, `wrap2`, and more.

Available unary ops: `neg`, `abs`, `ceil`, `floor`, `sqrt`, `exp`, `log`, `sin`, `cos`, `tan`, `midicps`, `cpsmidi`, `dbamp`, `ampdb`, `tanh`, `distort`, `softclip`, and more.

### Multi-channel expansion

When an array is passed as an input, the UGen automatically expands:

```ts
// Creates two SinOsc UGens at 440Hz and 880Hz
const oscs = SinOsc.ar([440, 880]);
```

### Controls

```ts
import { control, Rate } from '@/lib/ugen';

const freq = control('freq', 440);               // control-rate (default)
const amp = control('amp', 0.5, Rate.Scalar);     // scalar (set once)
```

## HTML Plugin API

Plugins define SynthDefs declaratively in HTML. The compiler processes `<sc-synthdef>` elements with `<sc-ugen>` and `<sc-control>` children:

```html
<sc-synthdef name="myOsc">
    <sc-control name="freq" value="440"/>
    <sc-control name="amp" value="0.2"/>
    <sc-ugen name="osc" type="SinOsc">
        <sc-control name="freq" bind="freq"/>
    </sc-ugen>
    <sc-ugen name="vol" type="BinaryOpUGen" op="*">
        <sc-control name="a" bind="osc"/>
        <sc-control name="b" bind="amp"/>
    </sc-ugen>
    <sc-ugen name="out" type="Out">
        <sc-control name="bus" value="0"/>
        <sc-control name="channelsArray" bind="vol"/>
    </sc-ugen>
</sc-synthdef>
```

All 367 built-in SuperCollider UGens are available via the `type` attribute. The `op` attribute on `BinaryOpUGen` and `UnaryOpUGen` specifies which operation to perform.
