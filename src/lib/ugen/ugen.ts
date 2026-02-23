/** Calculation rates matching the SCgf binary encoding. */
export const Rate = {
  Scalar: 0,
  Control: 1,
  Audio: 2,
} as const;

export type Rate = (typeof Rate)[keyof typeof Rate];

/** A valid input to a UGen: another UGen (output 0), a specific output, or a constant. */
export type UGenInput = UGen | UGenOutput | number;

/** References a specific output channel of a multi-output UGen. */
export class UGenOutput {
  constructor(
    readonly source: UGen,
    readonly outputIndex: number,
  ) {}
}

/** A single unit generator node in the synth graph. */
export class UGen {
  /** Position in the SynthDef's node list. Set by SynthDef.addUGen(). */
  synthIndex = -1;

  constructor(
    readonly className: string,
    readonly rate: Rate,
    readonly inputs: UGenInput[],
    readonly numOutputs: number,
    readonly specialIndex: number = 0,
  ) {
    const ctx = currentContext();
    if (!ctx) {
      throw new Error(
        `${className}: UGens must be created inside a synthDef() function`,
      );
    }
    ctx.addUGen(this);
  }

  /** Get a reference to a specific output channel (for multi-output UGens). */
  output(index: number): UGenOutput {
    if (index < 0 || index >= this.numOutputs) {
      throw new RangeError(
        `Output ${index} out of range for ${this.className} (has ${this.numOutputs})`,
      );
    }
    return new UGenOutput(this, index);
  }
}

// ---------------------------------------------------------------------------
// SynthDef build context
// ---------------------------------------------------------------------------

export interface SynthDefContext {
  addUGen(ugen: UGen): void;
  addControl(name: string, defaultValue: number, rate: Rate): UGen;
}

const ctxStack: SynthDefContext[] = [];

export function currentContext(): SynthDefContext | undefined {
  return ctxStack[ctxStack.length - 1];
}

export function pushContext(ctx: SynthDefContext): void {
  ctxStack.push(ctx);
}

export function popContext(): void {
  ctxStack.pop();
}

// ---------------------------------------------------------------------------
// Rate helpers
// ---------------------------------------------------------------------------

export function inputRate(input: UGenInput): Rate {
  if (typeof input === 'number') return Rate.Scalar;
  if (input instanceof UGenOutput) return input.source.rate;
  return input.rate;
}

export function maxRate(...inputs: UGenInput[]): Rate {
  let r: Rate = Rate.Scalar;
  for (const x of inputs) {
    const ir = inputRate(x);
    if (ir > r) r = ir;
  }
  return r;
}
