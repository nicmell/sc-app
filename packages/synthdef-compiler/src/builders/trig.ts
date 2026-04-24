// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Clip a signal outside given thresholds.
 * 
 * Clip a signal outside given thresholds. This differs from the ugen clip2 in
 * that it allows one to set both low and high thresholds.
 */
export class Clip {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Clip {
    const b = new Clip();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Clip {
    const b = new Clip();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** The signal to be clipped */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** Low threshold of clipping. Must be less then hi */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** High threshold of clipping. Must be greater then lo */
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
    inputs.push(this._in);
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("Clip", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Fold a signal outside given thresholds.
 * 
 * Folds input wave to within the lo and hi thresholds. This differs from the
 * ugen fold2 in that it allows one to set both low and high thresholds.
 */
export class Fold {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Fold {
    const b = new Fold();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Fold {
    const b = new Fold();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** low threshold */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** high threshold */
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
    inputs.push(this._in);
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("Fold", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Gate or hold
 * 
 * Lets signal flow when trig is positive, otherwise holds last input value
 */
export class Gate {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Gate {
    const b = new Gate();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Gate {
    const b = new Gate();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Input signal. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
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
    inputs.push(this._in);
    inputs.push(this._trig);
    const idx = def.addUgen("Gate", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Tests if a signal is within a given range
 * 
 * If in is >= lo and <= hi output 1.0, otherwise output 0.0. Output is initially
 * zero.
 */
export class InRange {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): InRange {
    const b = new InRange();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): InRange {
    const b = new InRange();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** low threshold */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** high threshold */
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
    inputs.push(this._in);
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("InRange", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Test if a point is within a given rectangle.
 * 
 * Outputs one if the 2d coordinate of x,y input values falls inside a rectangle,
 * else zero
 */
export class InRect {
  private _calcRate!: Rate;
  private _x!: UGenInput;
  private _y!: UGenInput;
  private _left!: UGenInput;
  private _top!: UGenInput;
  private _right!: UGenInput;
  private _bottom!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): InRect {
    const b = new InRect();
    b._calcRate = 'audio';
    b._x = { tag: 'constant', val: 0 };
    b._y = { tag: 'constant', val: 0 };
    b._left = { tag: 'constant', val: 0 };
    b._top = { tag: 'constant', val: 0 };
    b._right = { tag: 'constant', val: 0 };
    b._bottom = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): InRect {
    const b = new InRect();
    b._calcRate = 'control';
    b._x = { tag: 'constant', val: 0 };
    b._y = { tag: 'constant', val: 0 };
    b._left = { tag: 'constant', val: 0 };
    b._top = { tag: 'constant', val: 0 };
    b._right = { tag: 'constant', val: 0 };
    b._bottom = { tag: 'constant', val: 0 };
    return b;
  }

  /** X component signal */
  x(v: UGenInputLike): this {
    this._x = toUGenInput(v);
    return this;
  }

  /** Y component signal */
  y(v: UGenInputLike): this {
    this._y = toUGenInput(v);
    return this;
  }

  left(v: UGenInputLike): this {
    this._left = toUGenInput(v);
    return this;
  }

  top(v: UGenInputLike): this {
    this._top = toUGenInput(v);
    return this;
  }

  right(v: UGenInputLike): this {
    this._right = toUGenInput(v);
    return this;
  }

  bottom(v: UGenInputLike): this {
    this._bottom = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._x);
    inputs.push(this._y);
    inputs.push(this._left);
    inputs.push(this._top);
    inputs.push(this._right);
    inputs.push(this._bottom);
    const idx = def.addUgen("InRect", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Output the last value before the input changed
 * 
 * Output the last value before the input changed by a threshold of diff
 */
export class LastValue {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _diff!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LastValue {
    const b = new LastValue();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._diff = { tag: 'constant', val: 0.01 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LastValue {
    const b = new LastValue();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._diff = { tag: 'constant', val: 0.01 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** difference threshold */
  diff(v: UGenInputLike): this {
    this._diff = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._diff);
    const idx = def.addUgen("LastValue", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Sample and hold
 * 
 * Holds input signal value when triggered.
 */
export class Latch {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Latch {
    const b = new Latch();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Latch {
    const b = new Latch();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Input signal. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
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
    inputs.push(this._in);
    inputs.push(this._trig);
    const idx = def.addUgen("Latch", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Output least changed
 * 
 * output whichever signal changed the least
 */
export class LeastChange {
  private _calcRate!: Rate;
  private _a!: UGenInput;
  private _b!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LeastChange {
    const b = new LeastChange();
    b._calcRate = 'audio';
    b._a = { tag: 'constant', val: 0 };
    b._b = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LeastChange {
    const b = new LeastChange();
    b._calcRate = 'control';
    b._a = { tag: 'constant', val: 0 };
    b._b = { tag: 'constant', val: 0 };
    return b;
  }

  /** first input */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** second input */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._a);
    inputs.push(this._b);
    const idx = def.addUgen("LeastChange", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Output most changed
 * 
 * output whichever signal changed the most
 */
export class MostChange {
  private _calcRate!: Rate;
  private _a!: UGenInput;
  private _b!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): MostChange {
    const b = new MostChange();
    b._calcRate = 'audio';
    b._a = { tag: 'constant', val: 0 };
    b._b = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): MostChange {
    const b = new MostChange();
    b._calcRate = 'control';
    b._a = { tag: 'constant', val: 0 };
    b._b = { tag: 'constant', val: 0 };
    return b;
  }

  /** first input */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** second input */
  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._a);
    inputs.push(this._b);
    const idx = def.addUgen("MostChange", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Track peak signal amplitude
 * 
 * Outputs the peak amplitude of the signal so far, a trigger resets to current
 * value
 */
export class Peak {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _reset!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Peak {
    const b = new Peak();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Peak {
    const b = new Peak();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * Trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** Resets the counter to zero when triggered. */
  reset(v: UGenInputLike): this {
    this._reset = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._reset);
    const idx = def.addUgen("Peak", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Track peak signal amplitude
 * 
 * Outputs the peak signal amplitude, falling with decay over time until reaching
 * signal level
 */
export class PeakFollower {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _decay!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PeakFollower {
    const b = new PeakFollower();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._decay = { tag: 'constant', val: 0.999 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): PeakFollower {
    const b = new PeakFollower();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._decay = { tag: 'constant', val: 0.999 };
    return b;
  }

  /** input signal. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** decay factor. */
  decay(v: UGenInputLike): this {
    this._decay = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._decay);
    const idx = def.addUgen("PeakFollower", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Resettable linear ramp between two levels
 * 
 * Phasor is a linear ramp between start and end values. When its trigger input
 * crosses from non-positive to positive, Phasor's output will jump to its reset
 * position. Upon reaching the end of its ramp Phasor will wrap back to its
 * start. N.B. Since end is defined as the wrap point, its value is never
 * actually output.
 */
export class Phasor {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _rate!: UGenInput;
  private _start!: UGenInput;
  private _end!: UGenInput;
  private _resetPos!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Phasor {
    const b = new Phasor();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._rate = { tag: 'constant', val: 1 };
    b._start = { tag: 'constant', val: 0 };
    b._end = { tag: 'constant', val: 1 };
    b._resetPos = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Phasor {
    const b = new Phasor();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._rate = { tag: 'constant', val: 1 };
    b._start = { tag: 'constant', val: 0 };
    b._end = { tag: 'constant', val: 1 };
    b._resetPos = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * When triggered, reset value to reset-pos (default: 0, phasor outputs start
   * initially)
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /**
   * The amount of change per sample i.e at a rate of 1 the value of each sample
   * will be 1 greater than the preceding sample
   */
  rate(v: UGenInputLike): this {
    this._rate = toUGenInput(v);
    return this;
  }

  /** Starting point of the ramp */
  start(v: UGenInputLike): this {
    this._start = toUGenInput(v);
    return this;
  }

  /** End point of the ramp */
  end(v: UGenInputLike): this {
    this._end = toUGenInput(v);
    return this;
  }

  /** The value to jump to upon receiving a trigger */
  resetPos(v: UGenInputLike): this {
    this._resetPos = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._rate);
    inputs.push(this._start);
    inputs.push(this._end);
    inputs.push(this._resetPos);
    const idx = def.addUgen("Phasor", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Autocorrelation pitch follower
 * 
 * This is a better pitch follower than zero-crossing, but more costly of CPU.
 * For most purposes the default settings can be used and only in needs to be
 * supplied. Pitch returns two values (via an Array of OutputProxys, a freq which
 * is the pitch estimate and has-freq, which tells whether a pitch was found.
 * Some vowels are still problematic, for instance a wide open mouth sound
 * somewhere between a low pitched short 'a' sound as in 'sat', and long 'i'
 * sound as in 'fire', contains enough overtone energy to confuse the algorithm.
 * None of these settings are time variable.
 */
export class Pitch {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _initFreq!: UGenInput;
  private _minFreq!: UGenInput;
  private _maxFreq!: UGenInput;
  private _execFreq!: UGenInput;
  private _maxBinsPerOctave!: UGenInput;
  private _median!: UGenInput;
  private _ampThreshold!: UGenInput;
  private _peakThreshold!: UGenInput;
  private _downSample!: UGenInput;
  private _clar!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): Pitch {
    const b = new Pitch();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._initFreq = { tag: 'constant', val: 440 };
    b._minFreq = { tag: 'constant', val: 60 };
    b._maxFreq = { tag: 'constant', val: 4000 };
    b._execFreq = { tag: 'constant', val: 100 };
    b._maxBinsPerOctave = { tag: 'constant', val: 16 };
    b._median = { tag: 'constant', val: 1 };
    b._ampThreshold = { tag: 'constant', val: 0.01 };
    b._peakThreshold = { tag: 'constant', val: 0.5 };
    b._downSample = { tag: 'constant', val: 1 };
    b._clar = { tag: 'constant', val: 0 };
    return b;
  }

  /** Input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** Value of output pitch until first pitch detected. */
  initFreq(v: UGenInputLike): this {
    this._initFreq = toUGenInput(v);
    return this;
  }

  /** Minimum frequency of execution. */
  minFreq(v: UGenInputLike): this {
    this._minFreq = toUGenInput(v);
    return this;
  }

  /** Maximum frequency of execution. */
  maxFreq(v: UGenInputLike): this {
    this._maxFreq = toUGenInput(v);
    return this;
  }

  /**
   * The target rate to periodically execute in cps. Clipped between min-freq and
   * max-freq.
   */
  execFreq(v: UGenInputLike): this {
    this._execFreq = toUGenInput(v);
    return this;
  }

  /**
   * Number of lags for course search. A larger value will cause the coarse search
   * to take longer, a smaller value will cause the subsequent fine search to take
   * longer.
   */
  maxBinsPerOctave(v: UGenInputLike): this {
    this._maxBinsPerOctave = toUGenInput(v);
    return this;
  }

  /**
   * Median filter value of length median on the output estimation. Helps eliminate
   * outliers and jitter. Value of 1 means no filter.
   */
  median(v: UGenInputLike): this {
    this._median = toUGenInput(v);
    return this;
  }

  /**
   * Minum peak to peak amplitude of input signal before pitch estimation is
   * performed.
   */
  ampThreshold(v: UGenInputLike): this {
    this._ampThreshold = toUGenInput(v);
    return this;
  }

  /**
   * Finds the next peak that is above peak-threshold times the amplitude of the
   * peak at lag zero. A value of 0.5 does a pretty good job of eliminating
   * overtones.
   */
  peakThreshold(v: UGenInputLike): this {
    this._peakThreshold = toUGenInput(v);
    return this;
  }

  /**
   * Down sample the input signal by an integer factor. Helps reduce CPU overthead.
   * Also reduces pitch resolution.
   */
  downSample(v: UGenInputLike): this {
    this._downSample = toUGenInput(v);
    return this;
  }

  /** Clarity measurement (purity of the pitched signal) if greater than 0. */
  clar(v: UGenInputLike): this {
    this._clar = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._initFreq);
    inputs.push(this._minFreq);
    inputs.push(this._maxFreq);
    inputs.push(this._execFreq);
    inputs.push(this._maxBinsPerOctave);
    inputs.push(this._median);
    inputs.push(this._ampThreshold);
    inputs.push(this._peakThreshold);
    inputs.push(this._downSample);
    inputs.push(this._clar);
    const idx = def.addUgen("Pitch", this._calcRate, inputs, 2, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Pulse counter
 * 
 * Each input trigger increments a counter value that is output.
 */
export class PulseCount {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _reset!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PulseCount {
    const b = new PulseCount();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): PulseCount {
    const b = new PulseCount();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * Trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** Resets the counter to zero when triggered. */
  reset(v: UGenInputLike): this {
    this._reset = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._reset);
    const idx = def.addUgen("PulseCount", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Pulse divider
 * 
 * Outputs a trigger every div input triggers
 */
export class PulseDivider {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _div!: UGenInput;
  private _startVal!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PulseDivider {
    const b = new PulseDivider();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._div = { tag: 'constant', val: 2 };
    b._startVal = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): PulseDivider {
    const b = new PulseDivider();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._div = { tag: 'constant', val: 2 };
    b._startVal = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * Trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** Number of pulses to divide by. */
  div(v: UGenInputLike): this {
    this._div = toUGenInput(v);
    return this;
  }

  /**
   * Starting value for the trigger count. This lets you start somewhere in the
   * middle of a count, or if startCount is negative it adds that many counts to
   * the first time the output is triggers.
   */
  startVal(v: UGenInputLike): this {
    this._startVal = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._div);
    inputs.push(this._startVal);
    const idx = def.addUgen("PulseDivider", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Track maximum level
 * 
 * Outputs the maximum value received at the input. When triggered, the maximum
 * output value is reset to the current value.
 */
export class RunningMax {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): RunningMax {
    const b = new RunningMax();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): RunningMax {
    const b = new RunningMax();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Input signal. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
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
    inputs.push(this._in);
    inputs.push(this._trig);
    const idx = def.addUgen("RunningMax", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Track minimum level
 * 
 * Outputs the minimum value received at the input. When triggered, the minimum
 * output value is reset to the current value.
 */
export class RunningMin {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): RunningMin {
    const b = new RunningMin();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): RunningMin {
    const b = new RunningMin();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Input signal. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
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
    inputs.push(this._in);
    inputs.push(this._trig);
    const idx = def.addUgen("RunningMin", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Schmidt trigger
 * 
 * Outout one when signal greater than high, and zero when lower than low.
 */
export class Schmidt {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Schmidt {
    const b = new Schmidt();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Schmidt {
    const b = new Schmidt();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** low threshold */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** high threshold */
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
    inputs.push(this._in);
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("Schmidt", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Send information via OSC to Overtone
 * 
 * Send an array of values from the server via an message. The OSC message is
 * formed with cmd-name as the path, followed by two compulsary args: node-id
 * (the id of the node that sent the message) and reply-id (the value specified
 * in the params). These args are then followed by the list of values specified
 * in the params. For example, if the ugen is used as follows: (send-reply tr
 * \"/foobar\" [1 2 3] 42) When the trig tr triggers, Overtone will receive an
 * event that looks like the following (where 32 represents the node-id of the
 * synth that sent the message): {:path \"/foobar\
 */
export class SendReply {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _cmdName!: UGenInput;
  private _values!: UGenInput;
  private _replyId!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): SendReply {
    const b = new SendReply();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._cmdName = { tag: 'constant', val: 0 };
    b._values = { tag: 'constant', val: 0 };
    b._replyId = { tag: 'constant', val: -1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): SendReply {
    const b = new SendReply();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._cmdName = { tag: 'constant', val: 0 };
    b._values = { tag: 'constant', val: 0 };
    b._replyId = { tag: 'constant', val: -1 };
    return b;
  }

  /** Input trigger signal */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** A string or symbol, as a message name. */
  cmdName(v: UGenInputLike): this {
    this._cmdName = toUGenInput(v);
    return this;
  }

  /** Array of ugens, or valid ugen inputs */
  values(v: UGenInputLike): this {
    this._values = toUGenInput(v);
    return this;
  }

  /** Integer id (similar to that used by send-trig) */
  replyId(v: UGenInputLike): this {
    this._replyId = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._cmdName);
    inputs.push(this._values);
    inputs.push(this._replyId);
    const idx = def.addUgen("SendReply", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Send a /tr OSC message to Overtone
 * 
 * On receiving a trigger sends a :trigger event with id and value. This command
 * is the mechanism that synths can use to trigger events in clients. The trigger
 * message sent back to the client is this: int - node ID int - trigger ID float
 * - trigger value This is then presented as an event on the event-stream which
 * is a map containing the key :path with the string \"/tr\" and the key :args
 * containing a sequence of the values in the above order. i.e. {:path /tr, :args
 * (34 3 123.0)} See on-trigger, on-latest-trigger and on-sync-trigger for
 * registering handlers for trigger events.
 */
export class SendTrig {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _id!: UGenInput;
  private _value!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): SendTrig {
    const b = new SendTrig();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._id = { tag: 'constant', val: 0 };
    b._value = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): SendTrig {
    const b = new SendTrig();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._id = { tag: 'constant', val: 0 };
    b._value = { tag: 'constant', val: 0 };
    return b;
  }

  /** input trigger signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * an integer that will be passed with the trigger message. This is useful if you
   * have more than one send-trig in a synth design. Consider using trig-id to
   * genearate a unique id.
   */
  id(v: UGenInputLike): this {
    this._id = toUGenInput(v);
    return this;
  }

  /**
   * A ugen or float that will be polled at the time of trigger, and its value
   * passed with the trigger message
   */
  value(v: UGenInputLike): this {
    this._value = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._id);
    inputs.push(this._value);
    const idx = def.addUgen("SendTrig", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Set-reset flip flop
 * 
 * When a trigger is received the output is set to 1.0 Subsequent triggers have
 * no effect When a trigger is received in the reset input, the output is set
 * back to 0.0 One use of this is to have some precipitating event cause
 * something to happen until you reset it.
 */
export class SetResetFF {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _reset!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): SetResetFF {
    const b = new SetResetFF();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): SetResetFF {
    const b = new SetResetFF();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * Trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** Resets the counter to zero when triggered. */
  reset(v: UGenInputLike): this {
    this._reset = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._reset);
    const idx = def.addUgen("SetResetFF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Pulse counter
 * 
 * Triggers increment a counter which is output as a signal. The counter loops
 * around from max to min by step increments
 */
export class Stepper {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _reset!: UGenInput;
  private _min!: UGenInput;
  private _max!: UGenInput;
  private _step!: UGenInput;
  private _resetval!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Stepper {
    const b = new Stepper();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    b._min = { tag: 'constant', val: 0 };
    b._max = { tag: 'constant', val: 7 };
    b._step = { tag: 'constant', val: 1 };
    b._resetval = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Stepper {
    const b = new Stepper();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    b._min = { tag: 'constant', val: 0 };
    b._max = { tag: 'constant', val: 7 };
    b._step = { tag: 'constant', val: 1 };
    b._resetval = { tag: 'constant', val: 1 };
    return b;
  }

  /**
   * Trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** Resets the counter to resetval when triggered. */
  reset(v: UGenInputLike): this {
    this._reset = toUGenInput(v);
    return this;
  }

  /** minimum value of the counter. */
  min(v: UGenInputLike): this {
    this._min = toUGenInput(v);
    return this;
  }

  /** maximum value of the counter. */
  max(v: UGenInputLike): this {
    this._max = toUGenInput(v);
    return this;
  }

  /** step value each trigger. May be negative. */
  step(v: UGenInputLike): this {
    this._step = toUGenInput(v);
    return this;
  }

  /** value to which the counter is reset when it receives a reset trigger. */
  resetval(v: UGenInputLike): this {
    this._resetval = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._reset);
    inputs.push(this._min);
    inputs.push(this._max);
    inputs.push(this._step);
    inputs.push(this._resetval);
    const idx = def.addUgen("Stepper", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Triggered linear ramp
 * 
 * outputs a linear increasing signal by rate/second when trig input crosses from
 * non-positive to positive
 */
export class Sweep {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _rate!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Sweep {
    const b = new Sweep();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._rate = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Sweep {
    const b = new Sweep();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._rate = { tag: 'constant', val: 1 };
    return b;
  }

  /** trigger input */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** rate in seconds */
  rate(v: UGenInputLike): this {
    this._rate = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._rate);
    const idx = def.addUgen("Sweep", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Trigger delay
 * 
 * Delays an input trigger by dur, ignoring other triggers in the meantime
 */
export class TDelay {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _dur!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): TDelay {
    const b = new TDelay();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): TDelay {
    const b = new TDelay();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** input trigger signal. */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** delay time in seconds. */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._dur);
    const idx = def.addUgen("TDelay", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Trigger timer
 * 
 * Outputs time since last trigger
 */
export class Timer {
  private _calcRate!: Rate;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Timer {
    const b = new Timer();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Timer {
    const b = new Timer();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** trigger input */
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
    inputs.push(this._trig);
    const idx = def.addUgen("Timer", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Toggle flip flop
 * 
 * Flip-flops between zero and one each trigger
 */
export class ToggleFF {
  private _calcRate!: Rate;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): ToggleFF {
    const b = new ToggleFF();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): ToggleFF {
    const b = new ToggleFF();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** trigger input */
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
    inputs.push(this._trig);
    const idx = def.addUgen("ToggleFF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class Trapezoid {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _a!: UGenInput;
  private _b!: UGenInput;
  private _c!: UGenInput;
  private _d!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Trapezoid {
    const b = new Trapezoid();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._a = { tag: 'constant', val: 0.2 };
    b._b = { tag: 'constant', val: 0.4 };
    b._c = { tag: 'constant', val: 0.6 };
    b._d = { tag: 'constant', val: 0.8 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Trapezoid {
    const b = new Trapezoid();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._a = { tag: 'constant', val: 0.2 };
    b._b = { tag: 'constant', val: 0.4 };
    b._c = { tag: 'constant', val: 0.6 };
    b._d = { tag: 'constant', val: 0.8 };
    return b;
  }

  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  b(v: UGenInputLike): this {
    this._b = toUGenInput(v);
    return this;
  }

  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  d(v: UGenInputLike): this {
    this._d = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._a);
    inputs.push(this._b);
    inputs.push(this._c);
    inputs.push(this._d);
    const idx = def.addUgen("Trapezoid", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Timed trigger
 * 
 * When a nonpositive to positive transition occurs at the input, Trig outputs
 * the level of the triggering input for the specified duration, otherwise it
 * outputs zero.
 */
export class Trig {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _dur!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Trig {
    const b = new Trig();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Trig {
    const b = new Trig();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 0.1 };
    return b;
  }

  /**
   * trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** duration of the trigger output in seconds. */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._dur);
    const idx = def.addUgen("Trig", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Timed trigger
 * 
 * Outputs one for dur seconds whenever the input goes from negative to positive,
 * otherwise outputs 0.
 */
export class Trig1 {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _dur!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Trig1 {
    const b = new Trig1();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Trig1 {
    const b = new Trig1();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 0.1 };
    return b;
  }

  /**
   * trigger. Trigger can be any signal. A trigger happens when the signal changes
   * from non-positive to positive.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** duration of the trigger output in seconds. */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._dur);
    const idx = def.addUgen("Trig1", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Triggered window
 * 
 * When triggered, returns a random index value based on array as a list of
 * probabilities. By default the list of probabilities should sum to 1.0, when
 * the normalize flag is set to 1, the values get normalized by the ugen (less
 * efficient).
 */
export class TWindex {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _normalize!: UGenInput;
  private _channelsArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): TWindex {
    const b = new TWindex();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._normalize = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): TWindex {
    const b = new TWindex();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._normalize = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /**
   * Trigger - can be any signal. A trigger happens when the signal changes from
   * non-positive to positive.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** normalise flag - 0 off, 1 on */
  normalize(v: UGenInputLike): this {
    this._normalize = toUGenInput(v);
    return this;
  }

  /** list of probabilities */
  channelsArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._channelsArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._normalize);
    inputs.push(...this._channelsArray);
    const idx = def.addUgen("TWindex", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Wrap a signal outside given thresholds.
 * 
 * Wraps input wave to the low and high thresholds. This differs from the ugen
 * wrap2 in that it allows one to set both low and high thresholds.
 */
export class Wrap {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Wrap {
    const b = new Wrap();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Wrap {
    const b = new Wrap();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lo = { tag: 'constant', val: 0 };
    b._hi = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** low threshold */
  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  /** high threshold */
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
    inputs.push(this._in);
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("Wrap", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Zero crossing frequency follower
 * 
 * Outputs a frequency based upon the distance between interceptions of the X
 * axis. The X intercepts are determined via linear interpolation so this gives
 * better than just integer wavelength resolution. This is a very crude pitch
 * follower, but can be useful in some situations.
 */
export class ZeroCrossing {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): ZeroCrossing {
    const b = new ZeroCrossing();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): ZeroCrossing {
    const b = new ZeroCrossing();
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
    const idx = def.addUgen("ZeroCrossing", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
