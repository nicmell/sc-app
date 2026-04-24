// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/** all pass delay line, cubic interpolation */
export class AllpassC {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _maxDelayTime!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): AllpassC {
    const b = new AllpassC();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): AllpassC {
    const b = new AllpassC();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the maximum delay time in seconds. Used to initialize the delay buffer size */
  maxDelayTime(v: UGenInputLike): this {
    this._maxDelayTime = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._maxDelayTime);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("AllpassC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** all pass delay line, linear interpolation */
export class AllpassL {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _maxDelayTime!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): AllpassL {
    const b = new AllpassL();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): AllpassL {
    const b = new AllpassL();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the maximum delay time in seconds. Used to initialize the delay buffer size */
  maxDelayTime(v: UGenInputLike): this {
    this._maxDelayTime = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._maxDelayTime);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("AllpassL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * all pass delay line, no interpolation. See also AllpassC which uses cubic
 * interpolation, and AllpassL which uses linear interpolation. Cubic
 * interpolation is more computationally expensive than linear, but more
 * accurate.
 */
export class AllpassN {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _maxDelayTime!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): AllpassN {
    const b = new AllpassN();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): AllpassN {
    const b = new AllpassN();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the maximum delay time in seconds. Used to initialize the delay buffer size */
  maxDelayTime(v: UGenInputLike): this {
    this._maxDelayTime = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._maxDelayTime);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("AllpassN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** buffer based all pass delay line with cubic interpolation */
export class BufAllpassC {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _in!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufAllpassC {
    const b = new BufAllpassC();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** buffer number */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    inputs.push(this._in);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("BufAllpassC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** buffer based all pass delay line with linear interpolation */
export class BufAllpassL {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _in!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufAllpassL {
    const b = new BufAllpassL();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** buffer number */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    inputs.push(this._in);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("BufAllpassL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * buffer based all pass delay line with no interpolation. See also BufAllpassC
 * which uses cubic interpolation, and BufAllpassL which uses linear
 * interpolation. Cubic interpolation is more computationally expensive than
 * linear, but more accurate.
 */
export class BufAllpassN {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _in!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufAllpassN {
    const b = new BufAllpassN();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** buffer number */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    inputs.push(this._in);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("BufAllpassN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** buffer based comb delay line with cubic interpolation */
export class BufCombC {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _in!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufCombC {
    const b = new BufCombC();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** buffer number */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    inputs.push(this._in);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("BufCombC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** buffer based comb delay line with linear interpolation */
export class BufCombL {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _in!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufCombL {
    const b = new BufCombL();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** buffer number */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    inputs.push(this._in);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("BufCombL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * buffer based comb delay line with no interpolation. See also [BufCombL] which
 * uses linear interpolation, and BufCombC which uses cubic interpolation. Cubic
 * interpolation is more computationally expensive than linear, but more
 * accurate.
 */
export class BufCombN {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _in!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufCombN {
    const b = new BufCombN();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** buffer number */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    inputs.push(this._in);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("BufCombN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** buffer based simple delay line with cubic interpolation */
export class BufDelayC {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _in!: UGenInput;
  private _delayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufDelayC {
    const b = new BufDelayC();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BufDelayC {
    const b = new BufDelayC();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** buffer number */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    inputs.push(this._in);
    inputs.push(this._delayTime);
    const idx = def.addUgen("BufDelayC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** buffer based simple delay line with linear interpolation */
export class BufDelayL {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _in!: UGenInput;
  private _delayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufDelayL {
    const b = new BufDelayL();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BufDelayL {
    const b = new BufDelayL();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** buffer number */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    inputs.push(this._in);
    inputs.push(this._delayTime);
    const idx = def.addUgen("BufDelayL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * buffer based simple delay line with no interpolation. See also BufDelayL which
 * uses linear interpolation, and BufDelayC which uses cubic interpolation. Cubic
 * interpolation is more computationally expensive than linear, but more
 * accurate.
 */
export class BufDelayN {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _in!: UGenInput;
  private _delayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufDelayN {
    const b = new BufDelayN();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BufDelayN {
    const b = new BufDelayN();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** buffer number */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    inputs.push(this._in);
    inputs.push(this._delayTime);
    const idx = def.addUgen("BufDelayN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** comb delay line, cubic interpolation */
export class CombC {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _maxDelayTime!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): CombC {
    const b = new CombC();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): CombC {
    const b = new CombC();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the maximum delay time in seconds. Used to initialize the delay buffer size */
  maxDelayTime(v: UGenInputLike): this {
    this._maxDelayTime = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._maxDelayTime);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("CombC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** comb delay line, linear interpolation */
export class CombL {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _maxDelayTime!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): CombL {
    const b = new CombL();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): CombL {
    const b = new CombL();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the maximum delay time in seconds. Used to initialize the delay buffer size */
  maxDelayTime(v: UGenInputLike): this {
    this._maxDelayTime = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._maxDelayTime);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("CombL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * comb delay line, no interpolation. See also CombL which uses linear
 * interpolation, and CombC which uses cubic interpolation. Cubic interpolation
 * is more computationally expensive than linear, but more accurate.
 */
export class CombN {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _maxDelayTime!: UGenInput;
  private _delayTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): CombN {
    const b = new CombN();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): CombN {
    const b = new CombN();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the maximum delay time in seconds. Used to initialize the delay buffer size */
  maxDelayTime(v: UGenInputLike): this {
    this._maxDelayTime = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * time for the echoes to decay by 60 decibels. If this time is negative then the
   * feedback coefficient will be negative, thus emphasizing only odd harmonics at
   * an octave lower.
   */
  decayTime(v: UGenInputLike): this {
    this._decayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._maxDelayTime);
    inputs.push(this._delayTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("CombN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * delay input signal by one frame of samples. Note: for audio-rate signals the
 * delay is 1 audio frame, and for control-rate signals the delay is 1 control
 * period.
 */
export class Delay1 {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Delay1 {
    const b = new Delay1();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Delay1 {
    const b = new Delay1();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** input to be delayed. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    const idx = def.addUgen("Delay1", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** delay input signal by two frames of samples */
export class Delay2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Delay2 {
    const b = new Delay2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Delay2 {
    const b = new Delay2();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** input to be delayed. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    const idx = def.addUgen("Delay2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** simple delay line, cubic interpolation. */
export class DelayC {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _maxDelayTime!: UGenInput;
  private _delayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DelayC {
    const b = new DelayC();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DelayC {
    const b = new DelayC();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the maximum delay time in seconds. Used to initialize the delay buffer size */
  maxDelayTime(v: UGenInputLike): this {
    this._maxDelayTime = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._maxDelayTime);
    inputs.push(this._delayTime);
    const idx = def.addUgen("DelayC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** simple delay line, linear interpolation. */
export class DelayL {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _maxDelayTime!: UGenInput;
  private _delayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DelayL {
    const b = new DelayL();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DelayL {
    const b = new DelayL();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the maximum delay time in seconds. Used to initialize the delay buffer size */
  maxDelayTime(v: UGenInputLike): this {
    this._maxDelayTime = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._maxDelayTime);
    inputs.push(this._delayTime);
    const idx = def.addUgen("DelayL", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * simple delay line, no interpolation. See also DelayL which uses linear
 * interpolation, and DelayC which uses cubic interpolation. Cubic interpolation
 * is more computationally expensive than linear, but more accurate.
 */
export class DelayN {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _maxDelayTime!: UGenInput;
  private _delayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DelayN {
    const b = new DelayN();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DelayN {
    const b = new DelayN();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._maxDelayTime = { tag: 'constant', val: 0.2 };
    b._delayTime = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** the input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the maximum delay time in seconds. Used to initialize the delay buffer size */
  maxDelayTime(v: UGenInputLike): this {
    this._maxDelayTime = toUGenInput(v);
    return this;
  }

  /** delay time in seconds */
  delayTime(v: UGenInputLike): this {
    this._delayTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._maxDelayTime);
    inputs.push(this._delayTime);
    const idx = def.addUgen("DelayN", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Tap a delay line from a del-tap-wr UGen */
export class DelTapRd {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _phase!: UGenInput;
  private _delay!: UGenInput;
  private _interp!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DelTapRd {
    const b = new DelTapRd();
    b._calcRate = 'audio';
    b._buffer = { tag: 'constant', val: 0 };
    b._phase = { tag: 'constant', val: 0 };
    b._delay = { tag: 'constant', val: 0 };
    b._interp = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DelTapRd {
    const b = new DelTapRd();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._phase = { tag: 'constant', val: 0 };
    b._delay = { tag: 'constant', val: 0 };
    b._interp = { tag: 'constant', val: 1 };
    return b;
  }

  /**
   * buffer where del-tap-wr has written signal. Max delay time is based on buffer
   * size.
   */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** the current phase of the del-tap-wr UGen. This is the output of DelTapWr. */
  phase(v: UGenInputLike): this {
    this._phase = toUGenInput(v);
    return this;
  }

  /** A delay time in seconds. */
  delay(v: UGenInputLike): this {
    this._delay = toUGenInput(v);
    return this;
  }

  /** the kind of interpolation to be used. 1 is none, 2 is linear, 4 is cubic. */
  interp(v: UGenInputLike): this {
    this._interp = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._phase);
    inputs.push(this._delay);
    inputs.push(this._interp);
    const idx = def.addUgen("DelTapRd", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Tap a delay line from a del-tap-wr UGen */
export class DelTapWr {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DelTapWr {
    const b = new DelTapWr();
    b._calcRate = 'audio';
    b._buffer = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DelTapWr {
    const b = new DelTapWr();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** the buffer to write signal into. Max delay time is based on buffer size. */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** the signal to write to the buffer. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._in);
    const idx = def.addUgen("DelTapWr", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
