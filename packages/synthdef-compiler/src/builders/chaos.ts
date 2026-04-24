// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * a linear-interpolating (cusp map chaotic) sound generator based on the
 * difference equation: xn+1 = a - b*sqrt(|xn|)
 */
export class CuspL {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _xi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): CuspL {
    const b = new CuspL();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 1.9 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): CuspL {
    const b = new CuspL();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 1.9 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** first coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._xi);
    const idx = def.addUgen("CuspL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a non-interpolating (cusp map chaotic) sound generator based on the difference
 * equation: xn+1 = a - b*sqrt(|xn|)
 */
export class CuspN {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _xi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): CuspN {
    const b = new CuspN();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 1.9 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): CuspN {
    const b = new CuspN();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 1.9 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** first coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._xi);
    const idx = def.addUgen("CuspN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a cubic-interpolating feedback sine with chaotic phase indexing sound
 * generator. This uses a linear congruential function to drive the phase
 * indexing of a sine wave. For im = 1, fb = 0, and a = 1 a normal sinewave
 * results.
 */
export class FBSineC {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _im!: UGenInput;
  private _fb!: UGenInput;
  private _a!: UGenInput;
  private _c!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): FBSineC {
    const b = new FBSineC();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._im = { tag: 'constant', val: 1 };
    b._fb = { tag: 'constant', val: 0.1 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.1 };
    b._yi = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): FBSineC {
    const b = new FBSineC();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._im = { tag: 'constant', val: 1 };
    b._fb = { tag: 'constant', val: 0.1 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.1 };
    b._yi = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** index multiplier amount */
  im(v: UGenInputLike): this {
    this._im = toUGenInput(v);
    return this;
  }

  /** feedback amount */
  fb(v: UGenInputLike): this {
    this._fb = toUGenInput(v);
    return this;
  }

  /** phase multiplier amount */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** phase increment amount */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._im);
    inputs.push(this._fb);
    inputs.push(this._a);
    inputs.push(this._c);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("FBSineC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a linear-interpolating feedback sine with chaotic phase indexing sound
 * generator. This uses a linear congruential function to drive the phase
 * indexing of a sine wave. For im = 1, fb = 0, and a = 1 a normal sinewave
 * results.
 */
export class FBSineL {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _im!: UGenInput;
  private _fb!: UGenInput;
  private _a!: UGenInput;
  private _c!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): FBSineL {
    const b = new FBSineL();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._im = { tag: 'constant', val: 1 };
    b._fb = { tag: 'constant', val: 0.1 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.1 };
    b._yi = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): FBSineL {
    const b = new FBSineL();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._im = { tag: 'constant', val: 1 };
    b._fb = { tag: 'constant', val: 0.1 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.1 };
    b._yi = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** index multiplier amount */
  im(v: UGenInputLike): this {
    this._im = toUGenInput(v);
    return this;
  }

  /** feedback amount */
  fb(v: UGenInputLike): this {
    this._fb = toUGenInput(v);
    return this;
  }

  /** phase multiplier amount */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** phase increment amount */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._im);
    inputs.push(this._fb);
    inputs.push(this._a);
    inputs.push(this._c);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("FBSineL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a non-interpolating feedback sine with chaotic phase indexing sound generator.
 * This uses a linear congruential function to drive the phase indexing of a sine
 * wave. For im = 1, fb = 0, and a = 1 a normal sinewave results.
 */
export class FBSineN {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _im!: UGenInput;
  private _fb!: UGenInput;
  private _a!: UGenInput;
  private _c!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): FBSineN {
    const b = new FBSineN();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._im = { tag: 'constant', val: 1 };
    b._fb = { tag: 'constant', val: 0.1 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.1 };
    b._yi = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): FBSineN {
    const b = new FBSineN();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._im = { tag: 'constant', val: 1 };
    b._fb = { tag: 'constant', val: 0.1 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.1 };
    b._yi = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** index multiplier amount */
  im(v: UGenInputLike): this {
    this._im = toUGenInput(v);
    return this;
  }

  /** feedback amount */
  fb(v: UGenInputLike): this {
    this._fb = toUGenInput(v);
    return this;
  }

  /** phase multiplier amount */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** phase increment amount */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._im);
    inputs.push(this._fb);
    inputs.push(this._a);
    inputs.push(this._c);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("FBSineN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A linear-interpolating (gingerbreadman map chaotic) sound generator based on
 * the difference equations: xn+1 = 1 - yn + |xn| yn+1 = xn
 */
export class GbmanL {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): GbmanL {
    const b = new GbmanL();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._xi = { tag: 'constant', val: 1.2 };
    b._yi = { tag: 'constant', val: 2.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): GbmanL {
    const b = new GbmanL();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._xi = { tag: 'constant', val: 1.2 };
    b._yi = { tag: 'constant', val: 2.1 };
    return b;
  }

  /** iteration frequency in Hz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("GbmanL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A non-interpolating (gingerbreadman map chaotic) sound generator based on the
 * difference equations: xn+1 = 1 - yn + |xn| yn+1 = xn
 */
export class GbmanN {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): GbmanN {
    const b = new GbmanN();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._xi = { tag: 'constant', val: 1.2 };
    b._yi = { tag: 'constant', val: 2.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): GbmanN {
    const b = new GbmanN();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._xi = { tag: 'constant', val: 1.2 };
    b._yi = { tag: 'constant', val: 2.1 };
    return b;
  }

  /** iteration frequency in Hz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("GbmanN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a cubic-interpolating (henon map chaotic) sound generator based on the
 * difference equation: x[n+2] = 1 - a*(x[n+1]^)2 + bx[n]. This equation was
 * discovered by French astronomer Michel Hénon while studying the orbits of
 * stars in globular clusters.
 */
export class HenonC {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _x0!: UGenInput;
  private _x1!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): HenonC {
    const b = new HenonC();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.4 };
    b._b = { tag: 'constant', val: 0.3 };
    b._x0 = { tag: 'constant', val: 0 };
    b._x1 = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): HenonC {
    const b = new HenonC();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.4 };
    b._b = { tag: 'constant', val: 0.3 };
    b._x0 = { tag: 'constant', val: 0 };
    b._x1 = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  x0(v: UGenInputLike): this {
    this._x0 = toUGenInput(v);
    return this;
  }

  /** second value of x */
  x1(v: UGenInputLike): this {
    this._x1 = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._x0);
    inputs.push(this._x1);
    const idx = def.addUgen("HenonC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a linear-interpolating (henon map chaotic) sound generator based on the
 * difference equation: x[n+2] = 1 - a*(x[n+1]^)2 + bx[n]. This equation was
 * discovered by French astronomer Michel Hénon while studying the orbits of
 * stars in globular clusters.
 */
export class HenonL {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _x0!: UGenInput;
  private _x1!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): HenonL {
    const b = new HenonL();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.4 };
    b._b = { tag: 'constant', val: 0.3 };
    b._x0 = { tag: 'constant', val: 0 };
    b._x1 = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): HenonL {
    const b = new HenonL();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.4 };
    b._b = { tag: 'constant', val: 0.3 };
    b._x0 = { tag: 'constant', val: 0 };
    b._x1 = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  x0(v: UGenInputLike): this {
    this._x0 = toUGenInput(v);
    return this;
  }

  /** second value of x */
  x1(v: UGenInputLike): this {
    this._x1 = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._x0);
    inputs.push(this._x1);
    const idx = def.addUgen("HenonL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a non-interpolating (henon map chaotic) sound generator based on the
 * difference equation: x[n+2] = 1 - a*(x[n+1]^)2 + bx[n]. This equation was
 * discovered by French astronomer Michel Hénon while studying the orbits of
 * stars in globular clusters.
 */
export class HenonN {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _x0!: UGenInput;
  private _x1!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): HenonN {
    const b = new HenonN();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.4 };
    b._b = { tag: 'constant', val: 0.3 };
    b._x0 = { tag: 'constant', val: 0 };
    b._x1 = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): HenonN {
    const b = new HenonN();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.4 };
    b._b = { tag: 'constant', val: 0.3 };
    b._x0 = { tag: 'constant', val: 0 };
    b._x1 = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  x0(v: UGenInputLike): this {
    this._x0 = toUGenInput(v);
    return this;
  }

  /** second value of x */
  x1(v: UGenInputLike): this {
    this._x1 = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._x0);
    inputs.push(this._x1);
    const idx = def.addUgen("HenonN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a cubic-interpolating (latoocarfian chaotic) sound generator. Parameters a and
 * b should be in the range from -3 to +3, and parameters c and d should be in
 * the range from 0.5 to 1.5. The function can, depending on the parameters
 * given, give continuous chaotic output, converge to a single value (silence) or
 * oscillate in a cycle (tone).
 */
export class LatoocarfianC {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _c!: UGenInput;
  private _d!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LatoocarfianC {
    const b = new LatoocarfianC();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 3 };
    b._c = { tag: 'constant', val: 0.5 };
    b._d = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LatoocarfianC {
    const b = new LatoocarfianC();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 3 };
    b._c = { tag: 'constant', val: 0.5 };
    b._d = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** 3rd coefficient */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** 4th coefficient */
  d(v: UGenInputLike): this {
    this._d = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._c);
    inputs.push(this._d);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("LatoocarfianC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a linear-interpolating (latoocarfian chaotic) sound generator. Parameters a
 * and b should be in the range from -3 to +3, and parameters c and d should be
 * in the range from 0.5 to 1.5. The function can, depending on the parameters
 * given, give continuous chaotic output, converge to a single value (silence) or
 * oscillate in a cycle (tone).
 */
export class LatoocarfianL {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _c!: UGenInput;
  private _d!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LatoocarfianL {
    const b = new LatoocarfianL();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 3 };
    b._c = { tag: 'constant', val: 0.5 };
    b._d = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LatoocarfianL {
    const b = new LatoocarfianL();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 3 };
    b._c = { tag: 'constant', val: 0.5 };
    b._d = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** 3rd coefficient */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** 4th coefficient */
  d(v: UGenInputLike): this {
    this._d = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._c);
    inputs.push(this._d);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("LatoocarfianL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a non-interpolating (latoocarfian chaotic) sound generator. Parameters a and b
 * should be in the range from -3 to +3, and parameters c and d should be in the
 * range from 0.5 to 1.5. The function can, depending on the parameters given,
 * give continuous chaotic output, converge to a single value (silence) or
 * oscillate in a cycle (tone).
 */
export class LatoocarfianN {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _c!: UGenInput;
  private _d!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LatoocarfianN {
    const b = new LatoocarfianN();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 3 };
    b._c = { tag: 'constant', val: 0.5 };
    b._d = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LatoocarfianN {
    const b = new LatoocarfianN();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: 3 };
    b._c = { tag: 'constant', val: 0.5 };
    b._d = { tag: 'constant', val: 0.5 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** 3rd coefficient */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** 4th coefficient */
  d(v: UGenInputLike): this {
    this._d = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._c);
    inputs.push(this._d);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("LatoocarfianN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a cubic-interpolating (linear congruential chaotic) sound generator. The
 * output signal is automatically scaled to a range of [-1, 1].
 */
export class LinCongC {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _c!: UGenInput;
  private _m!: UGenInput;
  private _xi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LinCongC {
    const b = new LinCongC();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.13 };
    b._m = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LinCongC {
    const b = new LinCongC();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.13 };
    b._m = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz. */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** multiplier amount */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** increment amount */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** modulus amount */
  m(v: UGenInputLike): this {
    this._m = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._c);
    inputs.push(this._m);
    inputs.push(this._xi);
    const idx = def.addUgen("LinCongC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a linear-interpolating (linear congruential chaotic) sound generator. The
 * output signal is automatically scaled to a range of [-1, 1].
 */
export class LinCongL {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _c!: UGenInput;
  private _m!: UGenInput;
  private _xi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LinCongL {
    const b = new LinCongL();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.13 };
    b._m = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LinCongL {
    const b = new LinCongL();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.13 };
    b._m = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz. */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** multiplier amount */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** increment amount */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** modulus amount */
  m(v: UGenInputLike): this {
    this._m = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._c);
    inputs.push(this._m);
    inputs.push(this._xi);
    const idx = def.addUgen("LinCongL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a non-interpolating (linear congruential chaotic) sound generator. The output
 * signal is automatically scaled to a range of [-1, 1].
 */
export class LinCongN {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _c!: UGenInput;
  private _m!: UGenInput;
  private _xi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LinCongN {
    const b = new LinCongN();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.13 };
    b._m = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LinCongN {
    const b = new LinCongN();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1.1 };
    b._c = { tag: 'constant', val: 0.13 };
    b._m = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz. */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** multiplier amount */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** increment amount */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** modulus amount */
  m(v: UGenInputLike): this {
    this._m = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._c);
    inputs.push(this._m);
    inputs.push(this._xi);
    const idx = def.addUgen("LinCongN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * lorenz chaotic generator. A strange attractor discovered by Edward N. Lorenz
 * while studying mathematical models of the atmosphere. The time step amount h
 * determines the rate at which the ODE is evaluated. Higher values will increase
 * the rate, but cause more instability. A safe choice is the default amount of
 * 0.05.
 */
export class LorenzL {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _s!: UGenInput;
  private _r!: UGenInput;
  private _b!: UGenInput;
  private _h!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;
  private _zi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LorenzL {
    const b = new LorenzL();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._s = { tag: 'constant', val: 10 };
    b._r = { tag: 'constant', val: 28 };
    b._b = { tag: 'constant', val: 2.667 };
    b._h = { tag: 'constant', val: 0.05 };
    b._xi = { tag: 'constant', val: 0.1 };
    b._yi = { tag: 'constant', val: 0 };
    b._zi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LorenzL {
    const b = new LorenzL();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._s = { tag: 'constant', val: 10 };
    b._r = { tag: 'constant', val: 28 };
    b._b = { tag: 'constant', val: 2.667 };
    b._h = { tag: 'constant', val: 0.05 };
    b._xi = { tag: 'constant', val: 0.1 };
    b._yi = { tag: 'constant', val: 0 };
    b._zi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st variable */
  s(v: UGenInputLike): this {
    this._s = toUGenInput(v);
    return this;
  }

  /** 2nd variable */
  r(v: UGenInputLike): this {
    this._r = toUGenInput(v);
    return this;
  }

  /** 3rd variable */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** integration time stamp */
  h(v: UGenInputLike): this {
    this._h = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /** initial value of z */
  zi(v: UGenInputLike): this {
    this._zi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._s);
    inputs.push(this._r);
    inputs.push(this._b);
    inputs.push(this._h);
    inputs.push(this._xi);
    inputs.push(this._yi);
    inputs.push(this._zi);
    const idx = def.addUgen("LorenzL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a cubic-interpolating (general quadratic map chaotic) sound generator based on
 * the difference equation: xn+1 = axn2 + bxn + c
 */
export class QuadC {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _c!: UGenInput;
  private _xi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): QuadC {
    const b = new QuadC();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: -1 };
    b._c = { tag: 'constant', val: -0.75 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): QuadC {
    const b = new QuadC();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: -1 };
    b._c = { tag: 'constant', val: -0.75 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** 3rd coefficient */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._c);
    inputs.push(this._xi);
    const idx = def.addUgen("QuadC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a linear-interpolating (general quadratic map chaotic) sound generator based
 * on the difference equation: xn+1 = axn2 + bxn + c
 */
export class QuadL {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _c!: UGenInput;
  private _xi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): QuadL {
    const b = new QuadL();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: -1 };
    b._c = { tag: 'constant', val: -0.75 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): QuadL {
    const b = new QuadL();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: -1 };
    b._c = { tag: 'constant', val: -0.75 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** 3rd coefficient */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._c);
    inputs.push(this._xi);
    const idx = def.addUgen("QuadL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a non-interpolating (general quadratic map chaotic) sound generator based on
 * the difference equation: xn+1 = axn2 + bxn + c
 */
export class QuadN {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _c!: UGenInput;
  private _xi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): QuadN {
    const b = new QuadN();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: -1 };
    b._c = { tag: 'constant', val: -0.75 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): QuadN {
    const b = new QuadN();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._a = { tag: 'constant', val: 1 };
    b._b = { tag: 'constant', val: -1 };
    b._c = { tag: 'constant', val: -0.75 };
    b._xi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /** 3rd coefficient */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._c);
    inputs.push(this._xi);
    const idx = def.addUgen("QuadN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * linear-interpolating standard map chaotic generator. The standard map is an
 * area preserving map of a cylinder discovered by the plasma physicist Boris
 * Chirikov.
 */
export class StandardL {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _k!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): StandardL {
    const b = new StandardL();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._k = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): StandardL {
    const b = new StandardL();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._k = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** perturbation amount */
  k(v: UGenInputLike): this {
    this._k = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._k);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("StandardL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * standard map chaotic generator. The standard map is an area preserving map of
 * a cylinder discovered by the plasma physicist Boris Chirikov.
 */
export class StandardN {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _k!: UGenInput;
  private _xi!: UGenInput;
  private _yi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): StandardN {
    const b = new StandardN();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 22050 };
    b._k = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): StandardN {
    const b = new StandardN();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 22050 };
    b._k = { tag: 'constant', val: 1 };
    b._xi = { tag: 'constant', val: 0.5 };
    b._yi = { tag: 'constant', val: 0 };
    return b;
  }

  /** iteration frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** perturbation amount */
  k(v: UGenInputLike): this {
    this._k = toUGenInput(v);
    return this;
  }

  /** initial value of x */
  xi(v: UGenInputLike): this {
    this._xi = toUGenInput(v);
    return this;
  }

  /** initial value of y */
  yi(v: UGenInputLike): this {
    this._yi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._k);
    inputs.push(this._xi);
    inputs.push(this._yi);
    const idx = def.addUgen("StandardN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
