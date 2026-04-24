/**
 * Input to a UGen: a constant, the default output of another UGen, or a
 * specific output of a multi-output UGen.
 *
 * UGen indices refer to positions in the `SynthDef`'s node list, returned by
 * `SynthDef.addUgen` / `SynthDef.addControl`.
 */
export type UGenInput =
  | { readonly tag: 'constant'; readonly val: number }
  | { readonly tag: 'ugen'; readonly val: number }
  | { readonly tag: 'ugenOutput'; readonly ugenIdx: number; readonly outputIdx: number };

/** Build a constant input. Convenience constructor. */
export function k(v: number): UGenInput {
  return { tag: 'constant', val: v };
}

/** Build a UGen output-0 reference. Convenience constructor. */
export function u(idx: number): UGenInput {
  return { tag: 'ugen', val: idx };
}

/** Build a specific UGen output reference. Convenience constructor. */
export function uo(ugenIdx: number, outputIdx: number): UGenInput {
  return { tag: 'ugenOutput', ugenIdx, outputIdx };
}

/**
 * Accept a number or a `UGenInput`. Numbers become `constant` inputs.
 * Used as the setter-method signature on every typed builder.
 */
export type UGenInputLike = number | UGenInput;

export function toUGenInput(v: UGenInputLike): UGenInput {
  return typeof v === 'number' ? { tag: 'constant', val: v } : v;
}

export function ugenIndex(input: UGenInput): number | null {
  switch (input.tag) {
    case 'constant':
      return null;
    case 'ugen':
      return input.val;
    case 'ugenOutput':
      return input.ugenIdx;
  }
}

export function outputIndex(input: UGenInput): number {
  switch (input.tag) {
    case 'constant':
    case 'ugen':
      return 0;
    case 'ugenOutput':
      return input.outputIdx;
  }
}
