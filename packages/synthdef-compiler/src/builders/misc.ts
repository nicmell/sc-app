// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/** models the path of a bouncing object that is reflected by a vibrating surface */
export class Ball {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _g!: UGenInput;
  private _damp!: UGenInput;
  private _friction!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Ball {
    const b = new Ball();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._g = { tag: 'constant', val: 1 };
    b._damp = { tag: 'constant', val: 0 };
    b._friction = { tag: 'constant', val: 0.01 };
    return b;
  }

  /** modulated surface level */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** gravity */
  g(v: UGenInputLike): this {
    this._g = toUGenInput(v);
    return this;
  }

  /** damping on impact */
  damp(v: UGenInputLike): this {
    this._damp = toUGenInput(v);
    return this;
  }

  /** proximity from which on attraction to surface starts */
  friction(v: UGenInputLike): this {
    this._friction = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._g);
    inputs.push(this._damp);
    inputs.push(this._friction);
    const idx = def.addUgen("Ball", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A reverb coded from experiments with faust. Valid parameter range from 0 to 1.
 * Values outside this range are clipped by the UGen.
 */
export class FreeVerb {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _mix!: UGenInput;
  private _room!: UGenInput;
  private _damp!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): FreeVerb {
    const b = new FreeVerb();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._mix = { tag: 'constant', val: 0.33 };
    b._room = { tag: 'constant', val: 0.5 };
    b._damp = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** The input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** Dry/wet balance. range 0..1 */
  mix(v: UGenInputLike): this {
    this._mix = toUGenInput(v);
    return this;
  }

  /** Room size. rage 0..1 */
  room(v: UGenInputLike): this {
    this._room = toUGenInput(v);
    return this;
  }

  /** Reverb HF damp. range 0..1 */
  damp(v: UGenInputLike): this {
    this._damp = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._mix);
    inputs.push(this._room);
    inputs.push(this._damp);
    const idx = def.addUgen("FreeVerb", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A two-channel reverb coded from experiments with faust. Valid parameter range
 * from 0 to 1. Values outside this range are clipped by the UGen.
 */
export class FreeVerb2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _in2!: UGenInput;
  private _mix!: UGenInput;
  private _room!: UGenInput;
  private _damp!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): FreeVerb2 {
    const b = new FreeVerb2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._in2 = { tag: 'constant', val: 0 };
    b._mix = { tag: 'constant', val: 0.33 };
    b._room = { tag: 'constant', val: 0.5 };
    b._damp = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Input signal channel 1 */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** Input signal channel 2 */
  in2(v: UGenInputLike): this {
    this._in2 = toUGenInput(v);
    return this;
  }

  /** Dry/wet balance. range 0..1 */
  mix(v: UGenInputLike): this {
    this._mix = toUGenInput(v);
    return this;
  }

  /** Room size. rage 0..1 */
  room(v: UGenInputLike): this {
    this._room = toUGenInput(v);
    return this;
  }

  /** Reverb HF damp. range 0..1 */
  damp(v: UGenInputLike): this {
    this._damp = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._in2);
    inputs.push(this._mix);
    inputs.push(this._room);
    inputs.push(this._damp);
    const idx = def.addUgen("FreeVerb2", this._calcRate, inputs, 2, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * FreqShift implements single sideband amplitude modulation, also known as
 * frequency shifting, but not to be confused with pitch shifting. Frequency
 * shifting moves all the components of a signal by a fixed amount but does not
 * preserve the original harmonic relationships.
 */
export class FreqShift {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _phase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): FreqShift {
    const b = new FreqShift();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 0 };
    b._phase = { tag: 'constant', val: 0 };
    return b;
  }

  /** The signal to process */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** Amount of shift in cycles per second */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Phase of the frequency shift (0 - 2pi) */
  phase(v: UGenInputLike): this {
    this._phase = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._phase);
    const idx = def.addUgen("FreqShift", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * An implementation of the dynamic stochastic synthesis generator conceived by
 * Iannis Xenakis and described in Formalized Music (1992, Stuyvesant, NY:
 * Pendragon Press) chapter 9 (pp 246-254) and chapters 13 and 14 (pp 289-322).
 * The BASIC program in the book was written by Marie-Helene Serra so I think it
 * helpful to credit her too. The program code has been adapted to avoid
 * infinities in the probability distribution functions. The distributions are
 * hard-coded in C but there is an option to have new amplitude or time
 * breakpoints sampled from a continuous controller input.
 */
export class Gendy1 {
  private _calcRate!: Rate;
  private _ampdist!: UGenInput;
  private _durdist!: UGenInput;
  private _adparam!: UGenInput;
  private _ddparam!: UGenInput;
  private _minfreq!: UGenInput;
  private _maxfreq!: UGenInput;
  private _ampscale!: UGenInput;
  private _durscale!: UGenInput;
  private _initCps!: UGenInput;
  private _knum!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Gendy1 {
    const b = new Gendy1();
    b._calcRate = 'audio';
    b._ampdist = { tag: 'constant', val: 1 };
    b._durdist = { tag: 'constant', val: 1 };
    b._adparam = { tag: 'constant', val: 1 };
    b._ddparam = { tag: 'constant', val: 1 };
    b._minfreq = { tag: 'constant', val: 440 };
    b._maxfreq = { tag: 'constant', val: 660 };
    b._ampscale = { tag: 'constant', val: 0.5 };
    b._durscale = { tag: 'constant', val: 0.5 };
    b._initCps = { tag: 'constant', val: 12 };
    b._knum = { tag: 'constant', val: 12 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Gendy1 {
    const b = new Gendy1();
    b._calcRate = 'control';
    b._ampdist = { tag: 'constant', val: 1 };
    b._durdist = { tag: 'constant', val: 1 };
    b._adparam = { tag: 'constant', val: 1 };
    b._ddparam = { tag: 'constant', val: 1 };
    b._minfreq = { tag: 'constant', val: 440 };
    b._maxfreq = { tag: 'constant', val: 660 };
    b._ampscale = { tag: 'constant', val: 0.5 };
    b._durscale = { tag: 'constant', val: 0.5 };
    b._initCps = { tag: 'constant', val: 12 };
    b._knum = { tag: 'constant', val: 12 };
    return b;
  }

  /**
   * Choice of probability distribution for the next perturbation of the amplitude
   * of a control point. The distributions are (adapted from the GENDYN program in
   * Formalized Music): 0- LINEAR,1- CAUCHY, 2- LOGIST, 3- HYPERBCOS, 4- ARCSINE,
   * 5- EXPON, 6- SINUS, Where the sinus (Xenakis' name) is in this implementation
   * taken as sampling from a third party oscillator. See example below.
   */
  ampdist(v: UGenInputLike): this {
    this._ampdist = toUGenInput(v);
    return this;
  }

  /**
   * Choice of distribution for the perturbation of the current inter control point
   * duration.
   */
  durdist(v: UGenInputLike): this {
    this._durdist = toUGenInput(v);
    return this;
  }

  /**
   * A parameter for the shape of the amplitude probability distribution, requires
   * values in the range 0.0001 to 1 (there are safety checks in the code so don't
   * worry too much if you want to modulate!)
   */
  adparam(v: UGenInputLike): this {
    this._adparam = toUGenInput(v);
    return this;
  }

  /**
   * A parameter for the shape of the duration probability distribution, requires
   * values in the range 0.0001 to 1
   */
  ddparam(v: UGenInputLike): this {
    this._ddparam = toUGenInput(v);
    return this;
  }

  /**
   * Minimum allowed frequency of oscillation for the Gendy1 oscillator, so gives
   * the largest period the duration is allowed to take on.
   */
  minfreq(v: UGenInputLike): this {
    this._minfreq = toUGenInput(v);
    return this;
  }

  /**
   * Maximum allowed frequency of oscillation for the Gendy1 oscillator, so gives
   * the smallest period the duration is allowed to take on.
   */
  maxfreq(v: UGenInputLike): this {
    this._maxfreq = toUGenInput(v);
    return this;
  }

  /**
   * Normally 0.0 to 1.0, multiplier for the distribution's delta value for
   * amplitude. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
   * amplitude.
   */
  ampscale(v: UGenInputLike): this {
    this._ampscale = toUGenInput(v);
    return this;
  }

  /**
   * Normally 0.0 to 1.0, multiplier for the distribution's delta value for
   * duration. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
   * duration.
   */
  durscale(v: UGenInputLike): this {
    this._durscale = toUGenInput(v);
    return this;
  }

  /**
   * Initialise the number of control points in the memory. Xenakis specifies 12.
   * There would be this number of control points per cycle of the oscillator,
   * though the oscillator's period will constantly change due to the duration
   * distribution.
   */
  initCps(v: UGenInputLike): this {
    this._initCps = toUGenInput(v);
    return this;
  }

  /** Current number of utilised control points, allows modulation. */
  knum(v: UGenInputLike): this {
    this._knum = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._ampdist);
    inputs.push(this._durdist);
    inputs.push(this._adparam);
    inputs.push(this._ddparam);
    inputs.push(this._minfreq);
    inputs.push(this._maxfreq);
    inputs.push(this._ampscale);
    inputs.push(this._durscale);
    inputs.push(this._initCps);
    inputs.push(this._knum);
    const idx = def.addUgen("Gendy1", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * See gendy1 help file for background. This variant of GENDYN is closer to that
 * presented in Hoffmann, Peter. (2000) The New GENDYN Program. Computer Music
 * Journal 24:2, pp 31-38.
 */
export class Gendy2 {
  private _calcRate!: Rate;
  private _ampdist!: UGenInput;
  private _durdist!: UGenInput;
  private _adparam!: UGenInput;
  private _ddparam!: UGenInput;
  private _minfreq!: UGenInput;
  private _maxfreq!: UGenInput;
  private _ampscale!: UGenInput;
  private _durscale!: UGenInput;
  private _initCps!: UGenInput;
  private _knum!: UGenInput;
  private _a!: UGenInput;
  private _c!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Gendy2 {
    const b = new Gendy2();
    b._calcRate = 'audio';
    b._ampdist = { tag: 'constant', val: 1 };
    b._durdist = { tag: 'constant', val: 1 };
    b._adparam = { tag: 'constant', val: 1 };
    b._ddparam = { tag: 'constant', val: 1 };
    b._minfreq = { tag: 'constant', val: 440 };
    b._maxfreq = { tag: 'constant', val: 660 };
    b._ampscale = { tag: 'constant', val: 0.5 };
    b._durscale = { tag: 'constant', val: 0.5 };
    b._initCps = { tag: 'constant', val: 12 };
    b._knum = { tag: 'constant', val: 12 };
    b._a = { tag: 'constant', val: 1.17 };
    b._c = { tag: 'constant', val: 0.31 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Gendy2 {
    const b = new Gendy2();
    b._calcRate = 'control';
    b._ampdist = { tag: 'constant', val: 1 };
    b._durdist = { tag: 'constant', val: 1 };
    b._adparam = { tag: 'constant', val: 1 };
    b._ddparam = { tag: 'constant', val: 1 };
    b._minfreq = { tag: 'constant', val: 440 };
    b._maxfreq = { tag: 'constant', val: 660 };
    b._ampscale = { tag: 'constant', val: 0.5 };
    b._durscale = { tag: 'constant', val: 0.5 };
    b._initCps = { tag: 'constant', val: 12 };
    b._knum = { tag: 'constant', val: 12 };
    b._a = { tag: 'constant', val: 1.17 };
    b._c = { tag: 'constant', val: 0.31 };
    return b;
  }

  /**
   * Choice of probability distribution for the next perturbation of the amplitude
   * of a control point. The distributions are (adapted from the GENDYN program in
   * Formalized Music): 0- LINEAR, 1- CAUCHY, 2- LOGIST, 3- HYPERBCOS, 4- ARCSINE,
   * 5- EXPON, 6- SINUS, Where the sinus (Xenakis' name) is in this implementation
   * taken as sampling from a third party oscillator.
   */
  ampdist(v: UGenInputLike): this {
    this._ampdist = toUGenInput(v);
    return this;
  }

  /**
   * Choice of distribution for the perturbation of the current inter control point
   * duration.
   */
  durdist(v: UGenInputLike): this {
    this._durdist = toUGenInput(v);
    return this;
  }

  /**
   * A parameter for the shape of the amplitude probability distribution, requires
   * values in the range 0.0001 to 1 (there are safety checks in the code so don't
   * worry too much if you want to modulate!)
   */
  adparam(v: UGenInputLike): this {
    this._adparam = toUGenInput(v);
    return this;
  }

  /**
   * A parameter for the shape of the duration probability distribution, requires
   * values in the range 0.0001 to 1
   */
  ddparam(v: UGenInputLike): this {
    this._ddparam = toUGenInput(v);
    return this;
  }

  /**
   * Minimum allowed frequency of oscillation for the Gendy1 oscillator, so gives
   * the largest period the duration is allowed to take on.
   */
  minfreq(v: UGenInputLike): this {
    this._minfreq = toUGenInput(v);
    return this;
  }

  /**
   * Maximum allowed frequency of oscillation for the Gendy1 oscillator, so gives
   * the smallest period the duration is allowed to take on.
   */
  maxfreq(v: UGenInputLike): this {
    this._maxfreq = toUGenInput(v);
    return this;
  }

  /**
   * Normally 0.0 to 1.0, multiplier for the distribution's delta value for
   * amplitude. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
   * amplitude.
   */
  ampscale(v: UGenInputLike): this {
    this._ampscale = toUGenInput(v);
    return this;
  }

  /**
   * Normally 0.0 to 1.0, multiplier for the distribution's delta value for
   * duration. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
   * duration.
   */
  durscale(v: UGenInputLike): this {
    this._durscale = toUGenInput(v);
    return this;
  }

  /**
   * Initialise the number of control points in the memory. Xenakis specifies 12.
   * There would be this number of control points per cycle of the oscillator,
   * though the oscillator's period will constantly change due to the duration
   * distribution.
   */
  initCps(v: UGenInputLike): this {
    this._initCps = toUGenInput(v);
    return this;
  }

  /** Current number of utilised control points, allows modulation. */
  knum(v: UGenInputLike): this {
    this._knum = toUGenInput(v);
    return this;
  }

  /**
   * parameter for Lehmer random number generator perturbed by Xenakis as in
   * ((old*a)+c)%1.0
   */
  a(v: UGenInputLike): this {
    this._a = toUGenInput(v);
    return this;
  }

  /** parameter for Lehmer random number generator perturbed by Xenakis */
  c(v: UGenInputLike): this {
    this._c = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._ampdist);
    inputs.push(this._durdist);
    inputs.push(this._adparam);
    inputs.push(this._ddparam);
    inputs.push(this._minfreq);
    inputs.push(this._maxfreq);
    inputs.push(this._ampscale);
    inputs.push(this._durscale);
    inputs.push(this._initCps);
    inputs.push(this._knum);
    inputs.push(this._a);
    inputs.push(this._c);
    const idx = def.addUgen("Gendy2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * See Gendy1 help file for background. This variant of GENDYN normalises the
 * durations in each period to force oscillation at the desired pitch. The
 * breakpoints still get perturbed as in Gendy1. There is some glitching in the
 * oscillator caused by the stochastic effects: control points as they vary cause
 * big local jumps of amplitude. Put ampscale and durscale low to minimise this.
 * All parameters can be modulated at control rate except for initCPs which is
 * used only at initialisation.
 */
export class Gendy3 {
  private _calcRate!: Rate;
  private _ampdist!: UGenInput;
  private _durdist!: UGenInput;
  private _adparam!: UGenInput;
  private _ddparam!: UGenInput;
  private _freq!: UGenInput;
  private _ampscale!: UGenInput;
  private _durscale!: UGenInput;
  private _initCps!: UGenInput;
  private _knum!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Gendy3 {
    const b = new Gendy3();
    b._calcRate = 'audio';
    b._ampdist = { tag: 'constant', val: 1 };
    b._durdist = { tag: 'constant', val: 1 };
    b._adparam = { tag: 'constant', val: 1 };
    b._ddparam = { tag: 'constant', val: 1 };
    b._freq = { tag: 'constant', val: 440 };
    b._ampscale = { tag: 'constant', val: 0.5 };
    b._durscale = { tag: 'constant', val: 0.5 };
    b._initCps = { tag: 'constant', val: 12 };
    b._knum = { tag: 'constant', val: 12 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Gendy3 {
    const b = new Gendy3();
    b._calcRate = 'control';
    b._ampdist = { tag: 'constant', val: 1 };
    b._durdist = { tag: 'constant', val: 1 };
    b._adparam = { tag: 'constant', val: 1 };
    b._ddparam = { tag: 'constant', val: 1 };
    b._freq = { tag: 'constant', val: 440 };
    b._ampscale = { tag: 'constant', val: 0.5 };
    b._durscale = { tag: 'constant', val: 0.5 };
    b._initCps = { tag: 'constant', val: 12 };
    b._knum = { tag: 'constant', val: 12 };
    return b;
  }

  /**
   * Choice of probability distribution for the next perturbation of the amplitude
   * of a control point. The distributions are (adapted from the GENDYN program in
   * Formalized Music): 0- LINEAR,1- CAUCHY, 2- LOGIST, 3- HYPERBCOS, 4- ARCSINE,
   * 5- EXPON, 6- SINUS, Where the sinus (Xenakis' name) is in this implementation
   * taken as sampling from a third party oscillator.
   */
  ampdist(v: UGenInputLike): this {
    this._ampdist = toUGenInput(v);
    return this;
  }

  /**
   * Choice of distribution for the perturbation of the current inter control point
   * duration.
   */
  durdist(v: UGenInputLike): this {
    this._durdist = toUGenInput(v);
    return this;
  }

  /**
   * A parameter for the shape of the amplitude probability distribution, requires
   * values in the range 0.0001 to 1 (there are safety checks in the code so don't
   * worry too much if you want to modulate!)
   */
  adparam(v: UGenInputLike): this {
    this._adparam = toUGenInput(v);
    return this;
  }

  /**
   * A parameter for the shape of the duration probability distribution, requires
   * values in the range 0.0001 to 1
   */
  ddparam(v: UGenInputLike): this {
    this._ddparam = toUGenInput(v);
    return this;
  }

  /** Oscillation frquency. */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * Normally 0.0 to 1.0, multiplier for the distribution's delta value for
   * amplitude. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
   * amplitude.
   */
  ampscale(v: UGenInputLike): this {
    this._ampscale = toUGenInput(v);
    return this;
  }

  /**
   * Normally 0.0 to 1.0, multiplier for the distribution's delta value for
   * duration. An ampscale of 1.0 allows the full range of -1 to 1 for a change of
   * duration.
   */
  durscale(v: UGenInputLike): this {
    this._durscale = toUGenInput(v);
    return this;
  }

  /**
   * Initialise the number of control points in the memory. Xenakis specifies 12.
   * There would be this number of control points per cycle of the oscillator,
   * though the oscillator's period will constantly change due to the duration
   * distribution.
   */
  initCps(v: UGenInputLike): this {
    this._initCps = toUGenInput(v);
    return this;
  }

  /** Current number of utilised control points, allows modulation. */
  knum(v: UGenInputLike): this {
    this._knum = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._ampdist);
    inputs.push(this._durdist);
    inputs.push(this._adparam);
    inputs.push(this._ddparam);
    inputs.push(this._freq);
    inputs.push(this._ampscale);
    inputs.push(this._durscale);
    inputs.push(this._initCps);
    inputs.push(this._knum);
    const idx = def.addUgen("Gendy3", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A two-channel reverb UGen, based on the \"GVerb\" LADSPA effect by Juhana
 * Sadeharju (kouhia at nic.funet.fi). WARNING - in the current version of the
 * server, there are severe noise issues when you attempt to modify the roomsize
 * or set it to a value greater than 40.
 */
export class GVerb {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _roomsize!: UGenInput;
  private _revtime!: UGenInput;
  private _damping!: UGenInput;
  private _inputbw!: UGenInput;
  private _spread!: UGenInput;
  private _drylevel!: UGenInput;
  private _earlyreflevel!: UGenInput;
  private _taillevel!: UGenInput;
  private _maxroomsize!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): GVerb {
    const b = new GVerb();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._roomsize = { tag: 'constant', val: 10 };
    b._revtime = { tag: 'constant', val: 3 };
    b._damping = { tag: 'constant', val: 0.5 };
    b._inputbw = { tag: 'constant', val: 0.5 };
    b._spread = { tag: 'constant', val: 15 };
    b._drylevel = { tag: 'constant', val: 1 };
    b._earlyreflevel = { tag: 'constant', val: 0.7 };
    b._taillevel = { tag: 'constant', val: 0.5 };
    b._maxroomsize = { tag: 'constant', val: 300 };
    return b;
  }

  /** mono input */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** in squared meters. */
  roomsize(v: UGenInputLike): this {
    this._roomsize = toUGenInput(v);
    return this;
  }

  /** in seconds */
  revtime(v: UGenInputLike): this {
    this._revtime = toUGenInput(v);
    return this;
  }

  /**
   * 0 to 1, high frequency rolloff, 0 damps the reverb signal completely, 1 not at
   * all
   */
  damping(v: UGenInputLike): this {
    this._damping = toUGenInput(v);
    return this;
  }

  /** 0 to 1, same as damping control, but on the input signal */
  inputbw(v: UGenInputLike): this {
    this._inputbw = toUGenInput(v);
    return this;
  }

  /** a control on the stereo spread and diffusion of the reverb signal */
  spread(v: UGenInputLike): this {
    this._spread = toUGenInput(v);
    return this;
  }

  /** amount of dry signal */
  drylevel(v: UGenInputLike): this {
    this._drylevel = toUGenInput(v);
    return this;
  }

  /** amount of early reflection level */
  earlyreflevel(v: UGenInputLike): this {
    this._earlyreflevel = toUGenInput(v);
    return this;
  }

  /** amount of tail level */
  taillevel(v: UGenInputLike): this {
    this._taillevel = toUGenInput(v);
    return this;
  }

  /** to set the size of the delay lines. */
  maxroomsize(v: UGenInputLike): this {
    this._maxroomsize = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._roomsize);
    inputs.push(this._revtime);
    inputs.push(this._damping);
    inputs.push(this._inputbw);
    inputs.push(this._spread);
    inputs.push(this._drylevel);
    inputs.push(this._earlyreflevel);
    inputs.push(this._taillevel);
    inputs.push(this._maxroomsize);
    const idx = def.addUgen("GVerb", this._calcRate, inputs, 2, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class Hilbert {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Hilbert {
    const b = new Hilbert();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

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
    const idx = def.addUgen("Hilbert", this._calcRate, inputs, 2, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** A digital implementation of the Moog VCF (filter). */
export class MoogFF {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _gain!: UGenInput;
  private _reset!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): MoogFF {
    const b = new MoogFF();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 100 };
    b._gain = { tag: 'constant', val: 2 };
    b._reset = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): MoogFF {
    const b = new MoogFF();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 100 };
    b._gain = { tag: 'constant', val: 2 };
    b._reset = { tag: 'constant', val: 0 };
    return b;
  }

  /** The input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** The cutoff frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** The filter resonance gain, between zero and 4 */
  gain(v: UGenInputLike): this {
    this._gain = toUGenInput(v);
    return this;
  }

  /**
   * When greater than zero, this will reset the state of the digital filters at
   * the beginning of a computational block.
   */
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
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._gain);
    inputs.push(this._reset);
    const idx = def.addUgen("MoogFF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Partitioned convolution. Various additional buffers must be supplied. Mono
 * impulse response only! If inputting multiple channels, you'll need independent
 * PartConvs, one for each channel. But the charm is: impulse response can be as
 * large as you like (CPU load increases with IR size. Various tradeoffs based on
 * fftsize choice, due to rarer but larger FFTs. This plug-in uses amortisation
 * to spread processing and avoid spikes). Normalisation factors difficult to
 * anticipate; convolution piles up multiple copies of the input on top of
 * itself, so can easily overload.
 */
export class PartConv {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _fftsize!: UGenInput;
  private _irbufnum!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PartConv {
    const b = new PartConv();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._fftsize = { tag: 'constant', val: 0 };
    b._irbufnum = { tag: 'constant', val: 0 };
    return b;
  }

  /** Processing target. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Spectral convolution partition size (twice partition size). You must ensure
   * that the blocksize divides the partition size and there are at least two
   * blocks per partition (to allow for amortisation)
   */
  fftsize(v: UGenInputLike): this {
    this._fftsize = toUGenInput(v);
    return this;
  }

  /** Prepared buffer of spectra for each partition of the inpulse response */
  irbufnum(v: UGenInputLike): this {
    this._irbufnum = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._fftsize);
    inputs.push(this._irbufnum);
    const idx = def.addUgen("PartConv", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A time domain granular pitch shifter. Grains have a triangular amplitude
 * envelope and an overlap of 4:1.
 */
export class PitchShift {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _windowSize!: UGenInput;
  private _pitchRatio!: UGenInput;
  private _pitchDispersion!: UGenInput;
  private _timeDispersion!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PitchShift {
    const b = new PitchShift();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._windowSize = { tag: 'constant', val: 0.2 };
    b._pitchRatio = { tag: 'constant', val: 1 };
    b._pitchDispersion = { tag: 'constant', val: 0 };
    b._timeDispersion = { tag: 'constant', val: 0 };
    return b;
  }

  /** The input signal. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** The size of the grain window in seconds. This value cannot be modulated. */
  windowSize(v: UGenInputLike): this {
    this._windowSize = toUGenInput(v);
    return this;
  }

  /** The ratio of the pitch shift. Must be from 0.0 to 4.0 */
  pitchRatio(v: UGenInputLike): this {
    this._pitchRatio = toUGenInput(v);
    return this;
  }

  /** The maximum random deviation of the pitch from the pitchRatio. */
  pitchDispersion(v: UGenInputLike): this {
    this._pitchDispersion = toUGenInput(v);
    return this;
  }

  /**
   * A random offset of from zero to timeDispersion seconds is added to the delay
   * of each grain. Use of some dispersion can alleviate a hard comb filter effect
   * due to uniform grain placement. It can also be an effect in itself.
   * timeDispersion can be no larger than windowSize.
   */
  timeDispersion(v: UGenInputLike): this {
    this._timeDispersion = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._windowSize);
    inputs.push(this._pitchRatio);
    inputs.push(this._pitchDispersion);
    inputs.push(this._timeDispersion);
    const idx = def.addUgen("PitchShift", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Implements the Karplus-Strong style of synthesis, where a delay line (normally
 * starting with noise) is filtered and fed back on itself so that over time it
 * becomes periodic.
 */
export class Pluck {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _trig!: UGenInput;
  private _maxdelaytime!: UGenInput;
  private _delaytime!: UGenInput;
  private _decaytime!: UGenInput;
  private _coef!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Pluck {
    const b = new Pluck();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 1 };
    b._maxdelaytime = { tag: 'constant', val: 0.2 };
    b._delaytime = { tag: 'constant', val: 0.2 };
    b._decaytime = { tag: 'constant', val: 1 };
    b._coef = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** An excitation signal. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Upon a negative to positive transition, the excitation signal will be fed into
   * the delay line.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** The max delay time in seconds (initializes the internal delay buffer). */
  maxdelaytime(v: UGenInputLike): this {
    this._maxdelaytime = toUGenInput(v);
    return this;
  }

  /** Delay time in seconds. */
  delaytime(v: UGenInputLike): this {
    this._delaytime = toUGenInput(v);
    return this;
  }

  /**
   * Time for the echoes to decay by 60 decibels. Negative times emphasize odd
   * partials.
   */
  decaytime(v: UGenInputLike): this {
    this._decaytime = toUGenInput(v);
    return this;
  }

  /**
   * The coef of the internal OnePole filter. Values should be between -1 and +1
   * (larger values will be unstable... so be careful!).
   */
  coef(v: UGenInputLike): this {
    this._coef = toUGenInput(v);
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
    inputs.push(this._maxdelaytime);
    inputs.push(this._delaytime);
    inputs.push(this._decaytime);
    inputs.push(this._coef);
    const idx = def.addUgen("Pluck", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Physical model of resonating spring */
export class Spring {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _spring!: UGenInput;
  private _damp!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Spring {
    const b = new Spring();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._spring = { tag: 'constant', val: 0 };
    b._damp = { tag: 'constant', val: 0 };
    return b;
  }

  /** Modulated input force */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** Spring constant (incl. mass) */
  spring(v: UGenInputLike): this {
    this._spring = toUGenInput(v);
    return this;
  }

  /** Damping */
  damp(v: UGenInputLike): this {
    this._damp = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._spring);
    inputs.push(this._damp);
    const idx = def.addUgen("Spring", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * models the impacts of a bouncing object that is reflected by a vibrating
 * surface
 */
export class TBall {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _g!: UGenInput;
  private _damp!: UGenInput;
  private _friction!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): TBall {
    const b = new TBall();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._g = { tag: 'constant', val: 10 };
    b._damp = { tag: 'constant', val: 0 };
    b._friction = { tag: 'constant', val: 0.01 };
    return b;
  }

  /** modulated surface level */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** gravity */
  g(v: UGenInputLike): this {
    this._g = toUGenInput(v);
    return this;
  }

  /** damping on impact */
  damp(v: UGenInputLike): this {
    this._damp = toUGenInput(v);
    return this;
  }

  /** proximity from which on attraction to surface starts */
  friction(v: UGenInputLike): this {
    this._friction = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._g);
    inputs.push(this._damp);
    inputs.push(this._friction);
    const idx = def.addUgen("TBall", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
