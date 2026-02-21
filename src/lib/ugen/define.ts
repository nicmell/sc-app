import { UGen, UGenOutput, type UGenInput, type Rate, Rate as R } from './ugen';

// ---------------------------------------------------------------------------
// UGen spec & definition types
// ---------------------------------------------------------------------------

export interface UGenSpec {
  /** SuperCollider UGen class name (e.g. "SinOsc"). */
  name: string;
  /** Supported calculation rates. */
  rates: Rate[];
  /** Parameter names and defaults. `undefined` = required. */
  defaults: [name: string, defaultValue: number | undefined][];
  /** Number of output channels (default 1). */
  numOutputs?: number;
}

type UGenFactory = (...args: (UGenInput | UGenInput[])[]) => UGen | UGen[];
type MultiOutFactory = (...args: UGenInput[]) => UGenOutput[];

export interface UGenDef {
  ar: UGenFactory;
  kr: UGenFactory;
  ir: UGenFactory;
}

export interface MultiOutUGenDef {
  ar: MultiOutFactory;
  kr: MultiOutFactory;
  ir: MultiOutFactory;
}

// ---------------------------------------------------------------------------
// Multi-channel expansion
// ---------------------------------------------------------------------------

function expand(
  inputs: (UGenInput | UGenInput[])[],
  factory: (args: UGenInput[]) => UGen,
): UGen | UGen[] {
  let maxLen = 0;
  for (const inp of inputs) {
    if (Array.isArray(inp)) {
      if (inp.length === 0) throw new Error('Empty array in UGen inputs');
      if (inp.length > maxLen) maxLen = inp.length;
    }
  }
  if (maxLen === 0) return factory(inputs as UGenInput[]);
  return Array.from({ length: maxLen }, (_, i) =>
    factory(
      inputs.map((inp) =>
        Array.isArray(inp) ? inp[i % inp.length] : inp,
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Default-fill helper
// ---------------------------------------------------------------------------

function fillDefaults(
  args: (UGenInput | UGenInput[])[],
  defaults: [string, number | undefined][],
): (UGenInput | UGenInput[])[] {
  const result = [...args];
  for (let i = args.length; i < defaults.length; i++) {
    const [paramName, def] = defaults[i];
    if (def === undefined) {
      throw new Error(`Missing required argument: ${paramName}`);
    }
    result.push(def);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Factory: single-output UGen
// ---------------------------------------------------------------------------

function makeMethod(spec: UGenSpec, rate: Rate): UGenFactory {
  return (...args) => {
    const filled = fillDefaults(args, spec.defaults);
    return expand(filled, (expandedArgs) =>
      new UGen(spec.name, rate, expandedArgs, spec.numOutputs ?? 1),
    );
  };
}

function unsupported(name: string, method: string): () => never {
  return () => {
    throw new Error(`${name} does not support ${method}()`);
  };
}

export function defineUGen(spec: UGenSpec): UGenDef {
  return {
    ar: spec.rates.includes(R.Audio) ? makeMethod(spec, R.Audio) : unsupported(spec.name, 'ar'),
    kr: spec.rates.includes(R.Control) ? makeMethod(spec, R.Control) : unsupported(spec.name, 'kr'),
    ir: spec.rates.includes(R.Scalar) ? makeMethod(spec, R.Scalar) : unsupported(spec.name, 'ir'),
  };
}

// ---------------------------------------------------------------------------
// Factory: multi-output UGen
// ---------------------------------------------------------------------------

function makeMultiOutMethod(spec: UGenSpec, rate: Rate): MultiOutFactory {
  const numOut = spec.numOutputs ?? 2;
  return (...args: UGenInput[]) => {
    const filled = fillDefaults(args, spec.defaults) as UGenInput[];
    const ugen = new UGen(spec.name, rate, filled, numOut);
    return Array.from({ length: numOut }, (_, i) => ugen.output(i));
  };
}

export function defineMultiOutUGen(spec: UGenSpec): MultiOutUGenDef {
  return {
    ar: spec.rates.includes(R.Audio) ? makeMultiOutMethod(spec, R.Audio) : unsupported(spec.name, 'ar') as never,
    kr: spec.rates.includes(R.Control) ? makeMultiOutMethod(spec, R.Control) : unsupported(spec.name, 'kr') as never,
    ir: spec.rates.includes(R.Scalar) ? makeMultiOutMethod(spec, R.Scalar) : unsupported(spec.name, 'ir') as never,
  };
}
