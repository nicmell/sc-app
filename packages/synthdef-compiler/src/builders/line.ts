// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/** audio rate to control rate converter via linear interpolation */
export class A2K {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): A2K {
    const b = new A2K();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal */
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
    const idx = def.addUgen("A2K", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Basic psychoacoustic amplitude compensation." , :rates #{:ir :ar :kr} :check
 * (when-ar (first-input-ar "freq must be audio rate")) :doc "amplitude
 * compensation: because higher frequencies are normally perceived as louder.
 * Note that for frequencies very much smaller than root the amplitudes can
 * become very high. In this case limit the freqor use amp-comp-a Implements the
 * (optimized) formula: compensationFactor = (root / freq) ** exp
 * 
 * amplitude compensation: because higher frequencies are normally perceived as
 * louder. Note that for frequencies very much smaller than root the amplitudes
 * can become very high. In this case limit the freqor use amp-comp-a Implements
 * the (optimized) formula: compensationFactor = (root / freq) ** exp
 */
export class AmpComp {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _root!: UGenInput;
  private _exp!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): AmpComp {
    const b = new AmpComp();
    b._calcRate = 'scalar';
    b._freq = { tag: 'constant', val: 261.6256 };
    b._root = { tag: 'constant', val: 261.6256 };
    b._exp = { tag: 'constant', val: 0.3333 };
    return b;
  }

  /** Build at ar rate (Rate::Audio). */
  static ar(): AmpComp {
    const b = new AmpComp();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 261.6256 };
    b._root = { tag: 'constant', val: 261.6256 };
    b._exp = { tag: 'constant', val: 0.3333 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): AmpComp {
    const b = new AmpComp();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 261.6256 };
    b._root = { tag: 'constant', val: 261.6256 };
    b._exp = { tag: 'constant', val: 0.3333 };
    return b;
  }

  /** Input frequency value. For freq == root, the output is 1.0. */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Root freq relative to which the curve is calculated (usually lowest freq) */
  root(v: UGenInputLike): this {
    this._root = toUGenInput(v);
    return this;
  }

  /** Exponent: how steep the curve decreases for increasing freq */
  exp(v: UGenInputLike): this {
    this._exp = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._root);
    inputs.push(this._exp);
    const idx = def.addUgen("AmpComp", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Basic psychoacoustic amplitude compensation (ANSI A-weighting curve).
 * 
 * Higher frequencies are normally perceived as louder, which amp-comp-a
 * compensates. Following the measurings by Fletcher and Munson, the ANSI
 * standard describes a function for loudness vs. frequency. Note that this curve
 * is only valid for standardized amplitude. 1 For a simpler but more flexible
 * curve, see amp-comp
 */
export class AmpCompA {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _root!: UGenInput;
  private _minAmp!: UGenInput;
  private _rootAmp!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): AmpCompA {
    const b = new AmpCompA();
    b._calcRate = 'scalar';
    b._freq = { tag: 'constant', val: 1000 };
    b._root = { tag: 'constant', val: 0 };
    b._minAmp = { tag: 'constant', val: 0.32 };
    b._rootAmp = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at ar rate (Rate::Audio). */
  static ar(): AmpCompA {
    const b = new AmpCompA();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 1000 };
    b._root = { tag: 'constant', val: 0 };
    b._minAmp = { tag: 'constant', val: 0.32 };
    b._rootAmp = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): AmpCompA {
    const b = new AmpCompA();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 1000 };
    b._root = { tag: 'constant', val: 0 };
    b._minAmp = { tag: 'constant', val: 0.32 };
    b._rootAmp = { tag: 'constant', val: 1 };
    return b;
  }

  /** Input frequency value. For freq == root, the output is root-amp */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Root freq relative to which the curve is calculated (usually lowest freq) */
  root(v: UGenInputLike): this {
    this._root = toUGenInput(v);
    return this;
  }

  /** Amplitude at the minimum point of the curve (around 2512 Hz) */
  minAmp(v: UGenInputLike): this {
    this._minAmp = toUGenInput(v);
    return this;
  }

  /** Amplitude at the root frequency. */
  rootAmp(v: UGenInputLike): this {
    this._rootAmp = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._root);
    inputs.push(this._minAmp);
    inputs.push(this._rootAmp);
    const idx = def.addUgen("AmpCompA", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** outputs the initial value you give it. */
export class DC {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DC {
    const b = new DC();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DC {
    const b = new DC();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** constant value to output, cannot be modulated, set at initialisation time */
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
    const idx = def.addUgen("DC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** control rate to audio rate converter via linear interpolation. */
export class K2A {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): K2A {
    const b = new K2A();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal */
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
    const idx = def.addUgen("K2A", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Line generator.
 * 
 * Generates a line from the start value to the end value.
 */
export class Line {
  private _calcRate!: Rate;
  private _start!: UGenInput;
  private _end!: UGenInput;
  private _dur!: UGenInput;
  private _action!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Line {
    const b = new Line();
    b._calcRate = 'audio';
    b._start = { tag: 'constant', val: 0 };
    b._end = { tag: 'constant', val: 1 };
    b._dur = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Line {
    const b = new Line();
    b._calcRate = 'control';
    b._start = { tag: 'constant', val: 0 };
    b._end = { tag: 'constant', val: 1 };
    b._dur = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Starting value */
  start(v: UGenInputLike): this {
    this._start = toUGenInput(v);
    return this;
  }

  /** Ending value */
  end(v: UGenInputLike): this {
    this._end = toUGenInput(v);
    return this;
  }

  /** Duration in seconds */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /** A done action to be evaluated when the line is completed. Default: NO-ACTION */
  action(v: UGenInputLike): this {
    this._action = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._start);
    inputs.push(this._end);
    inputs.push(this._dur);
    inputs.push(this._action);
    const idx = def.addUgen("Line", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Map a linear range to an exponential range
 * 
 * Convert from a linear range to an exponential range. The dstlo and dsthi
 * arguments must be nonzero and have the same sign.
 */
export class LinExp {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _srclo!: UGenInput;
  private _srchi!: UGenInput;
  private _dstlo!: UGenInput;
  private _dsthi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LinExp {
    const b = new LinExp();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._srclo = { tag: 'constant', val: 0 };
    b._srchi = { tag: 'constant', val: 1 };
    b._dstlo = { tag: 'constant', val: 1 };
    b._dsthi = { tag: 'constant', val: 2 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LinExp {
    const b = new LinExp();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._srclo = { tag: 'constant', val: 0 };
    b._srchi = { tag: 'constant', val: 1 };
    b._dstlo = { tag: 'constant', val: 1 };
    b._dsthi = { tag: 'constant', val: 2 };
    return b;
  }

  /** Input to convert */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** Lower limit of input range */
  srclo(v: UGenInputLike): this {
    this._srclo = toUGenInput(v);
    return this;
  }

  /** Upper limit of input range */
  srchi(v: UGenInputLike): this {
    this._srchi = toUGenInput(v);
    return this;
  }

  /** Lower limit of output range */
  dstlo(v: UGenInputLike): this {
    this._dstlo = toUGenInput(v);
    return this;
  }

  /** Upper limit of output range */
  dsthi(v: UGenInputLike): this {
    this._dsthi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._srclo);
    inputs.push(this._srchi);
    inputs.push(this._dstlo);
    inputs.push(this._dsthi);
    const idx = def.addUgen("LinExp", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Continuously outputs 0 */
export class Silent {
  private _calcRate!: Rate;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Silent {
    const b = new Silent();
    b._calcRate = 'audio';
    b._numChannels = 1;
    return b;
  }

  /** Number of channels of silence. */
  numChannels(n: number): this {
    this._numChannels = n;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("Silent", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * control rate trigger to audio rate trigger converter (maximally one per
 * control period).
 */
export class T2A {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _offset!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): T2A {
    const b = new T2A();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._offset = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** sample offset within control period */
  offset(v: UGenInputLike): this {
    this._offset = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._offset);
    const idx = def.addUgen("T2A", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * audio rate trigger to control rate trigger converter. Uses the maxiumum
 * trigger in the input during each control period.
 */
export class T2K {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): T2K {
    const b = new T2K();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal */
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
    const idx = def.addUgen("T2K", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Exponential line generator.
 * 
 * Generates an exponential curve from the start value to the end value. Both the
 * start and end values must be non-zero and have the same sign.
 */
export class XLine {
  private _calcRate!: Rate;
  private _start!: UGenInput;
  private _end!: UGenInput;
  private _dur!: UGenInput;
  private _action!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): XLine {
    const b = new XLine();
    b._calcRate = 'audio';
    b._start = { tag: 'constant', val: 1 };
    b._end = { tag: 'constant', val: 2 };
    b._dur = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): XLine {
    const b = new XLine();
    b._calcRate = 'control';
    b._start = { tag: 'constant', val: 1 };
    b._end = { tag: 'constant', val: 2 };
    b._dur = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Starting value */
  start(v: UGenInputLike): this {
    this._start = toUGenInput(v);
    return this;
  }

  /** Ending value */
  end(v: UGenInputLike): this {
    this._end = toUGenInput(v);
    return this;
  }

  /** Duration in seconds */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /** A done action to be evaluated when the line is completed. Default: NO-ACTION */
  action(v: UGenInputLike): this {
    this._action = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._start);
    inputs.push(this._end);
    inputs.push(this._dur);
    inputs.push(this._action);
    const idx = def.addUgen("XLine", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
