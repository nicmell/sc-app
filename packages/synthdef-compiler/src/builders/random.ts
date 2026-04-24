// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * When it receives a trigger, it tosses a coin, and either passes the trigger or
 * doesn't.
 */
export class CoinGate {
  private _calcRate!: Rate;
  private _prob!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): CoinGate {
    const b = new CoinGate();
    b._calcRate = 'control';
    b._prob = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): CoinGate {
    const b = new CoinGate();
    b._calcRate = 'scalar';
    b._prob = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Value between 0 and 1 determines probability of either possibilities */
  prob(v: UGenInputLike): this {
    this._prob = toUGenInput(v);
    return this;
  }

  /** Trigger signal */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._prob);
    inputs.push(this._trig);
    const idx = def.addUgen("CoinGate", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates a single random float value in an exponential distributions from lo
 * to hi.
 */
export class ExpRand {
  private _calcRate!: Rate;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): ExpRand {
    const b = new ExpRand();
    b._calcRate = 'scalar';
    b._lo = { tag: 'constant', val: 0.01 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** Minimum value of generated float */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** Maximum value of generated float */
  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("ExpRand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Generates a single random integer value in uniform distribution from lo to hi */
export class IRand {
  private _calcRate!: Rate;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): IRand {
    const b = new IRand();
    b._calcRate = 'scalar';
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 127 };
    return b;
  }

  /** Minimum value of generated integer */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** Maximum value of generated integer */
  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("IRand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates a single random float value in linear distribution from lo to hi,
 * skewed towards lo if minmax < 0, otherwise skewed towards hi.
 */
export class LinRand {
  private _calcRate!: Rate;
  private _lo!: UGenInput;
  private _hi!: UGenInput;
  private _minmax!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): LinRand {
    const b = new LinRand();
    b._calcRate = 'scalar';
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    b._minmax = { tag: 'constant', val: 0 };
    return b;
  }

  /** Minimum value of generated float */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** Maximum value of generated float */
  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /** Skew direction (towards lo if negative otherwise hi) */
  minmax(v: UGenInputLike): this {
    this._minmax = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._lo);
    inputs.push(this._hi);
    inputs.push(this._minmax);
    const idx = def.addUgen("LinRand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates a single random float value in a sum of n uniform distributions from
 * lo to hi. n = 1 : uniform distribution - same as Rand n = 2 : triangular
 * distribution n = 3 : smooth hump As n increases, distribution converges
 * towards gaussian
 */
export class NRand {
  private _calcRate!: Rate;
  private _lo!: UGenInput;
  private _hi!: UGenInput;
  private _n!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): NRand {
    const b = new NRand();
    b._calcRate = 'scalar';
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    b._n = { tag: 'constant', val: 0 };
    return b;
  }

  /** Minimum value of generated float */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** Maximum value of generated float */
  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /** Distribution choice */
  n(v: UGenInputLike): this {
    this._n = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._lo);
    inputs.push(this._hi);
    inputs.push(this._n);
    const idx = def.addUgen("NRand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class Rand {
  private _calcRate!: Rate;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): Rand {
    const b = new Rand();
    b._calcRate = 'scalar';
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("Rand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Choose which random number generator to use for this synth. All synths that
 * use the same generator reproduce the same sequence of numbers when the same
 * seed is set again.
 */
export class RandID {
  private _calcRate!: Rate;
  private _seed!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): RandID {
    const b = new RandID();
    b._calcRate = 'scalar';
    b._seed = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): RandID {
    const b = new RandID();
    b._calcRate = 'control';
    b._seed = { tag: 'constant', val: 0 };
    return b;
  }

  /** Seed id */
  seed(v: UGenInputLike): this {
    this._seed = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._seed);
    const idx = def.addUgen("RandID", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * When the trigger signal changes from nonpositive to positive, the synth's
 * random generator seed is reset to the given value. All synths that use the
 * same random number generator reproduce the same sequence of numbers again.
 */
export class RandSeed {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _seed!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): RandSeed {
    const b = new RandSeed();
    b._calcRate = 'scalar';
    b._trig = { tag: 'constant', val: 0 };
    b._seed = { tag: 'constant', val: 56789 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): RandSeed {
    const b = new RandSeed();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._seed = { tag: 'constant', val: 56789 };
    return b;
  }

  /** Trigger signal */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** Seed value */
  seed(v: UGenInputLike): this {
    this._seed = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._seed);
    const idx = def.addUgen("RandSeed", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates a random float value in exponential distribution from lo to hi each
 * time the trig signal changes from nonpositive to positive values lo and hi
 * must both have the same sign and be non-zero.
 */
export class TExpRand {
  private _calcRate!: Rate;
  private _lo!: UGenInput;
  private _hi!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): TExpRand {
    const b = new TExpRand();
    b._calcRate = 'audio';
    b._lo = { tag: 'constant', val: 0.01 };
    b._hi = { tag: 'constant', val: 1 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): TExpRand {
    const b = new TExpRand();
    b._calcRate = 'control';
    b._lo = { tag: 'constant', val: 0.01 };
    b._hi = { tag: 'constant', val: 1 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Minimum value of generated float */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** Maximum value of generated float */
  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /** Trigger signal */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._lo);
    inputs.push(this._hi);
    inputs.push(this._trig);
    const idx = def.addUgen("TExpRand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates a random integer value in uniform distribution from lo to hi each
 * time the trig signal changes from nonpositive to positive values
 */
export class TIRand {
  private _calcRate!: Rate;
  private _lo!: UGenInput;
  private _hi!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): TIRand {
    const b = new TIRand();
    b._calcRate = 'control';
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 127 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ar rate (Rate::Audio). */
  static ar(): TIRand {
    const b = new TIRand();
    b._calcRate = 'audio';
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 127 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Minimum value of generated integer */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** Maximum value of generated integer */
  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /** Trigger signal */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._lo);
    inputs.push(this._hi);
    inputs.push(this._trig);
    const idx = def.addUgen("TIRand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates a random float value in uniform distribution from lo to hi each time
 * the trig signal changes from nonpositive to positive values
 */
export class TRand {
  private _calcRate!: Rate;
  private _lo!: UGenInput;
  private _hi!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): TRand {
    const b = new TRand();
    b._calcRate = 'control';
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ar rate (Rate::Audio). */
  static ar(): TRand {
    const b = new TRand();
    b._calcRate = 'audio';
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Minimum value of generated float */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** Maximum value of generated float */
  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /** Trigger signal */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._lo);
    inputs.push(this._hi);
    inputs.push(this._trig);
    const idx = def.addUgen("TRand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
