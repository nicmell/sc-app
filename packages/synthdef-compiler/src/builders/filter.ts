// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

export class APF {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _radius!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): APF {
    const b = new APF();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._radius = { tag: 'constant', val: 0.8 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): APF {
    const b = new APF();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._radius = { tag: 'constant', val: 0.8 };
    return b;
  }

  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  radius(v: UGenInputLike): this {
    this._radius = toUGenInput(v);
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
    inputs.push(this._radius);
    const idx = def.addUgen("APF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * second order Butterworth bandpass filter
 * 
 * A band pass filter permits the frequencies around a specified centre frequency
 * to pass unaltered through the filter while the frequencies either side are
 * attenuated. The frequencies that pass through are known as the bandwidth or
 * the band pass of the filter. Used to create timbres consisting of fizzy
 * harmonics, lo-fi qualities or very thin sounds that may form the basis of
 * sound effects.
 */
export class BPF {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BPF {
    const b = new BPF();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BPF {
    const b = new BPF();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** centre frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the reciprocal of Q. bandwidth / cutoffFreq */
  rq(v: UGenInputLike): this {
    this._rq = toUGenInput(v);
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
    inputs.push(this._rq);
    const idx = def.addUgen("BPF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * two zero fixed midpass which cuts out 0 Hz and the Nyquist frequency.
 * Implements the formula: out(i) = 0.5 * (in(i) - in(i-2))
 */
export class BPZ2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BPZ2 {
    const b = new BPZ2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BPZ2 {
    const b = new BPZ2();
    b._calcRate = 'control';
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
    const idx = def.addUgen("BPZ2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * second order Butterworth band reject filter
 * 
 * Band reject filters, also known as notch filters, attenuate a selected range
 * of frequencies effectively creating a notch in the sound. This type of filter
 * is handy for scooping out frequencies, thinning out a sound while leaving the
 * fundamental intact, making them useful for creating timbres that contain a
 * discernable pitch but do not have a high level of harmonic content.
 */
export class BRF {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BRF {
    const b = new BRF();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BRF {
    const b = new BRF();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** centre frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the reciprocal of Q. bandwidth / cutoffFreq */
  rq(v: UGenInputLike): this {
    this._rq = toUGenInput(v);
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
    inputs.push(this._rq);
    const idx = def.addUgen("BRF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * two zero fixed midcut which cuts out frequencies around 1/2 of the Nyquist
 * frequency. Implements the formula: out(i) = 0.5 * (in(i) + in(i-2))
 */
export class BRZ2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BRZ2 {
    const b = new BRZ2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BRZ2 {
    const b = new BRZ2();
    b._calcRate = 'control';
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
    const idx = def.addUgen("BRZ2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * triggered exponential decay.
 * 
 * This is essentially the same as integrator except that instead of supplying
 * the coefficient directly, it is calculated from a 60 dB decay time. This is
 * the time required for the integrator to lose 99.9 % of its value or -60dB.
 * This is useful for exponential decaying envelopes triggered by impulses.
 */
export class Decay {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Decay {
    const b = new Decay();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Decay {
    const b = new Decay();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60 dB decay time in seconds */
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
    inputs.push(this._decayTime);
    const idx = def.addUgen("Decay", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * triggered exponential attack and exponential decay. Decay has a very sharp
 * attack and can produce clicks. Decay2 rounds off the attack by subtracting one
 * Decay from another. (decay in attack-time decay-time) equivalent to: (- (decay
 * in attack-time decay-time) (decay in attack-time decay-time))
 */
export class Decay2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _attackTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Decay2 {
    const b = new Decay2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._attackTime = { tag: 'constant', val: 0.01 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Decay2 {
    const b = new Decay2();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._attackTime = { tag: 'constant', val: 0.01 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60 dB attack time in seconds. */
  attackTime(v: UGenInputLike): this {
    this._attackTime = toUGenInput(v);
    return this;
  }

  /** 60 dB decay time in seconds. */
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
    inputs.push(this._attackTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("Decay2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * If the signal input starts with silence at the beginning of the synth's
 * duration, then DetectSilence will wait indefinitely until the first sound
 * before starting to monitor for silence. This UGen outputs 1 if silence is
 * detected, otherwise 0.
 */
export class DetectSilence {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _amp!: UGenInput;
  private _time!: UGenInput;
  private _action!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DetectSilence {
    const b = new DetectSilence();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._amp = { tag: 'constant', val: 0.0001 };
    b._time = { tag: 'constant', val: 0.1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DetectSilence {
    const b = new DetectSilence();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._amp = { tag: 'constant', val: 0.0001 };
    b._time = { tag: 'constant', val: 0.1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** any source */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** when input falls below this, evaluate done action */
  amp(v: UGenInputLike): this {
    this._amp = toUGenInput(v);
    return this;
  }

  /**
   * the minimum duration of the input signal which input must fall below thresh
   * before this triggers. The default is 0.1 seconds
   */
  time(v: UGenInputLike): this {
    this._time = toUGenInput(v);
    return this;
  }

  /** the action to perform when silence is detected. Default: NO-ACTION */
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
    inputs.push(this._in);
    inputs.push(this._amp);
    inputs.push(this._time);
    inputs.push(this._action);
    const idx = def.addUgen("DetectSilence", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a resonant filter whose impulse response is like that of a sine wave with a
 * Decay2 envelope over it. The great advantage to this filter over FOF is that
 * there is no limit to the number of overlapping grains since the grain is just
 * the impulse response of the filter. Note that if attacktime == decaytime then
 * the signal cancels out and if attacktime > decaytime then the impulse response
 * is inverted.
 */
export class Formlet {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _attackTime!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Formlet {
    const b = new Formlet();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._attackTime = { tag: 'constant', val: 1 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Formlet {
    const b = new Formlet();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._attackTime = { tag: 'constant', val: 1 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** resonant frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** 60 dB attack time in seconds */
  attackTime(v: UGenInputLike): this {
    this._attackTime = toUGenInput(v);
    return this;
  }

  /** 60 dB decay time in seconds */
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
    inputs.push(this._freq);
    inputs.push(this._attackTime);
    inputs.push(this._decayTime);
    const idx = def.addUgen("Formlet", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * first order filter section. Formula is equivalent to: out(i) = (a0 * in(i)) +
 * (a1 * in(i-1)) + (b1 * out(i-1))
 */
export class FOS {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _a0!: UGenInput;
  private _a1!: UGenInput;
  private _b1!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): FOS {
    const b = new FOS();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._a0 = { tag: 'constant', val: 0 };
    b._a1 = { tag: 'constant', val: 0 };
    b._b1 = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): FOS {
    const b = new FOS();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._a0 = { tag: 'constant', val: 0 };
    b._a1 = { tag: 'constant', val: 0 };
    b._b1 = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** first coefficient */
  a0(v: UGenInputLike): this {
    this._a0 = toUGenInput(v);
    return this;
  }

  /** second coefficient */
  a1(v: UGenInputLike): this {
    this._a1 = toUGenInput(v);
    return this;
  }

  /** third coefficient */
  b1(v: UGenInputLike): this {
    this._b1 = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._a0);
    inputs.push(this._a1);
    inputs.push(this._b1);
    const idx = def.addUgen("FOS", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * second order high pass filter
 * 
 * A high pass filter lets through the frequencies above the cutoff point and
 * successfully dampens the frequencies below the cutoff point. This effectively
 * removes the fundamental frequency of the sound, leaving only the fizz harmonic
 * overtones. High pass filters are rarely used in the creation of instruments
 * and are predominantly used to create effervexcent sound effects of bright
 * timbres that can be laid over the top of another low pass sound to increase
 * the harmonic content.
 */
export class HPF {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): HPF {
    const b = new HPF();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): HPF {
    const b = new HPF();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** cutoff frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
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
    const idx = def.addUgen("HPF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * two point difference filter. Implements the formula: out(i) = 0.5 * (in(i) -
 * in(i-1))
 */
export class HPZ1 {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): HPZ1 {
    const b = new HPZ1();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): HPZ1 {
    const b = new HPZ1();
    b._calcRate = 'control';
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
    const idx = def.addUgen("HPZ1", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * two zero fixed highpass. Implements the formula: out(i) = 0.25 * (in(i) -
 * (2*in(i-1)) + in(i-2))
 */
export class HPZ2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): HPZ2 {
    const b = new HPZ2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): HPZ2 {
    const b = new HPZ2();
    b._calcRate = 'control';
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
    const idx = def.addUgen("HPZ2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * leaky integrator. Integrates an input signal with a leak. The formula
 * implemented is: out(0) = in(0) + (coef * out(-1))
 */
export class Integrator {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _coef!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Integrator {
    const b = new Integrator();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._coef = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Integrator {
    const b = new Integrator();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._coef = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** leak coefficient */
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
    inputs.push(this._coef);
    const idx = def.addUgen("Integrator", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * exponential lag, useful for smoothing out control signals. This is essentially
 * the same as OnePole except that instead of supplying the coefficient directly,
 * it is calculated from a 60 dB lag time. This is the time required for the
 * filter to converge to within 0.01 % of a value.
 */
export class Lag {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lagTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Lag {
    const b = new Lag();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lagTime = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Lag {
    const b = new Lag();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lagTime = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds */
  lagTime(v: UGenInputLike): this {
    this._lagTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._lagTime);
    const idx = def.addUgen("Lag", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * equivalent to (lag (lag in time) time), resulting in a smoother transition.
 * This saves on CPU as you only have to calculate the decay factor once instead
 * of twice. See lag for more details.
 */
export class Lag2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lagTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Lag2 {
    const b = new Lag2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lagTime = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Lag2 {
    const b = new Lag2();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lagTime = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds */
  lagTime(v: UGenInputLike): this {
    this._lagTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._lagTime);
    const idx = def.addUgen("Lag2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * equivalent to (lag-ud (lag-ud in up-t down-t) up-t down-t) thus resulting in a
 * smoother transition. This saves on CPU as you only have to calculate the decay
 * factor once instead of twice. See Lag for more details.
 */
export class Lag2UD {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lagTimeUp!: UGenInput;
  private _lagTimeDown!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Lag2UD {
    const b = new Lag2UD();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lagTimeUp = { tag: 'constant', val: 0.1 };
    b._lagTimeDown = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Lag2UD {
    const b = new Lag2UD();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lagTimeUp = { tag: 'constant', val: 0.1 };
    b._lagTimeDown = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds for the upgoing signal */
  lagTimeUp(v: UGenInputLike): this {
    this._lagTimeUp = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds for the downgoing signal */
  lagTimeDown(v: UGenInputLike): this {
    this._lagTimeDown = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._lagTimeUp);
    inputs.push(this._lagTimeDown);
    const idx = def.addUgen("Lag2UD", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * lag3 is equivalent to (lag (lag (lag in time) time) time), thus resulting in a
 * smoother transition. This saves on CPU as you only have to calculate the decay
 * factor once instead of three times. See Lag for more details.
 */
export class Lag3 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lagTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Lag3 {
    const b = new Lag3();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lagTime = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Lag3 {
    const b = new Lag3();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lagTime = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds */
  lagTime(v: UGenInputLike): this {
    this._lagTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._lagTime);
    const idx = def.addUgen("Lag3", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * equivalent to (lag-ud (lag-ud (lag-ud (in up-t down-t) up-t down-t) up-t,
 * down-t) thus resulting in a smoother transition. This saves on CPU as you only
 * have to calculate the decay factor once instead of three times.
 */
export class Lag3UD {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lagTimeUp!: UGenInput;
  private _lagTimeDown!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Lag3UD {
    const b = new Lag3UD();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lagTimeUp = { tag: 'constant', val: 0.1 };
    b._lagTimeDown = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Lag3UD {
    const b = new Lag3UD();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lagTimeUp = { tag: 'constant', val: 0.1 };
    b._lagTimeDown = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds for the upgoing signal */
  lagTimeUp(v: UGenInputLike): this {
    this._lagTimeUp = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds for the downgoing signal */
  lagTimeDown(v: UGenInputLike): this {
    this._lagTimeDown = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._lagTimeUp);
    inputs.push(this._lagTimeDown);
    const idx = def.addUgen("Lag3UD", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * the same as Lag except that you can supply a different 60 dB time for when the
 * signal goes up, from when the signal goes down
 */
export class LagUD {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lagTimeUp!: UGenInput;
  private _lagTimeDown!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LagUD {
    const b = new LagUD();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lagTimeUp = { tag: 'constant', val: 0.1 };
    b._lagTimeDown = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LagUD {
    const b = new LagUD();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lagTimeUp = { tag: 'constant', val: 0.1 };
    b._lagTimeDown = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds for the upgoing signal */
  lagTimeUp(v: UGenInputLike): this {
    this._lagTimeUp = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds for the downgoing signal */
  lagTimeDown(v: UGenInputLike): this {
    this._lagTimeDown = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._lagTimeUp);
    inputs.push(this._lagTimeDown);
    const idx = def.addUgen("LagUD", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * removes a DC offset from signal. For example, a square wave contains prolonged
 * sections of the cycle which are at +1 and -1 (the top and bottom of the square
 * sections). If you were to pass this wave through leak-dc, then these top parts
 * would taper back towards 0 with a greater slope as you move coef from 1 to 0..
 * Good starting point coef values are to 0.995 for audio rate and 0.9 for
 * control rate
 */
export class LeakDC {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _coef!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LeakDC {
    const b = new LeakDC();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._coef = { tag: 'constant', val: 0.995 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LeakDC {
    const b = new LeakDC();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._coef = { tag: 'constant', val: 0.995 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * leak coefficient. A value of 1 indicates no leakage and 0 indicates high
   * leakage - essentially the rate at which the offset will return back to 0
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
    inputs.push(this._coef);
    const idx = def.addUgen("LeakDC", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * second order Butterworth low pass filter
 * 
 * A low pass filter is a standard subtractive synthesis tool which removes
 * frequencies above a defined cut-off point. This typically has the effect of
 * making bright sounds duller. Using a low pass filter allows you to have
 * fine-grained control of the level of brightness/dullness to tune your timbre
 * in addition to allowing you to modulate the effect in real time thus creating
 * movement in the sound.
 */
export class LPF {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LPF {
    const b = new LPF();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LPF {
    const b = new LPF();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** cutoff frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
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
    const idx = def.addUgen("LPF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * two point average filter. Implements the formula: out(i) = 0.5 * (in(i) +
 * in(i-1))
 */
export class LPZ1 {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LPZ1 {
    const b = new LPZ1();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LPZ1 {
    const b = new LPZ1();
    b._calcRate = 'control';
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
    const idx = def.addUgen("LPZ1", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * two zero fixed lowpass. Implements the formula: out(i) = 0.25 * (in(i) +
 * (2*in(i-1)) + in(i-2))
 */
export class LPZ2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LPZ2 {
    const b = new LPZ2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LPZ2 {
    const b = new LPZ2();
    b._calcRate = 'control';
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
    const idx = def.addUgen("LPZ2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * returns the median of the last length input points. This non linear filter is
 * good at reducing impulse noise from a signal.
 */
export class Median {
  private _calcRate!: Rate;
  private _length!: UGenInput;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Median {
    const b = new Median();
    b._calcRate = 'audio';
    b._length = { tag: 'constant', val: 3 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Median {
    const b = new Median();
    b._calcRate = 'control';
    b._length = { tag: 'constant', val: 3 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * number of input points in which to find the median. Must be an odd number from
   * 1 to 31. If length is 1 then Median has no effect.
   */
  length(v: UGenInputLike): this {
    this._length = toUGenInput(v);
    return this;
  }

  /** Input signal to be processed */
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
    inputs.push(this._length);
    inputs.push(this._in);
    const idx = def.addUgen("Median", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** attenuates or boosts a frequency band */
export class MidEQ {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rq!: UGenInput;
  private _db!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): MidEQ {
    const b = new MidEQ();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    b._db = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): MidEQ {
    const b = new MidEQ();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    b._db = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** center frequency of the band in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the reciprocal of Q. bandwidth / cutoffFreq */
  rq(v: UGenInputLike): this {
    this._rq = toUGenInput(v);
    return this;
  }

  /** amount of boost (db > 0) or attenuation (db < 0) of the frequency band */
  db(v: UGenInputLike): this {
    this._db = toUGenInput(v);
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
    inputs.push(this._rq);
    inputs.push(this._db);
    const idx = def.addUgen("MidEQ", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A one pole filter. Implements the formula: out(i) = ((1 - abs(coef)) * in(i))
 * + (coef * out(i-1))
 */
export class OnePole {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _coef!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): OnePole {
    const b = new OnePole();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._coef = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): OnePole {
    const b = new OnePole();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._coef = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** feedback coefficient. Should be between -1 and +1 */
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
    inputs.push(this._coef);
    const idx = def.addUgen("OnePole", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A one zero filter. Implements the formula : out(i) = ((1 - abs(coef)) * in(i))
 * + (coef * in(i-1))
 */
export class OneZero {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _coef!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): OneZero {
    const b = new OneZero();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._coef = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): OneZero {
    const b = new OneZero();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._coef = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * feed forward coefficient. +0.5 makes a two point averaging filter (see also
   * lpz1), -0.5 makes a differentiator (see also hpz1), +1 makes a single sample
   * delay (see also delay1), -1 makes an inverted single sample delay.
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
    inputs.push(this._coef);
    const idx = def.addUgen("OneZero", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * similar to lag but with a linear rather than exponential lag, useful for
 * smoothing out control signals
 */
export class Ramp {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _lagTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Ramp {
    const b = new Ramp();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._lagTime = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Ramp {
    const b = new Ramp();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._lagTime = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60 dB lag time in seconds */
  lagTime(v: UGenInputLike): this {
    this._lagTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._lagTime);
    const idx = def.addUgen("Ramp", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A Note on Constant-Gain Digital Resonators,\" Computer Music Journal, vol 18,
 * no. 4, pp. 8-10, Winter 1994.\" Computer Music Journal, vol 18, no. 4, pp.
 * 8-10, Winter 1994.
 */
export class Resonz {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _bwr!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Resonz {
    const b = new Resonz();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._bwr = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Resonz {
    const b = new Resonz();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._bwr = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** resonant frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** bandwidth ratio (reciprocal of Q). rq = bandwidth / centerFreq */
  bwr(v: UGenInputLike): this {
    this._bwr = toUGenInput(v);
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
    inputs.push(this._bwr);
    const idx = def.addUgen("Resonz", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * resonant high pass filter
 * 
 * A resonant high pass filter lets through the frequencies above the cutoff
 * point and successfully dampens the frequencies below the cutoff point. This
 * effectively removes the fundamental frequency of the sound, leaving only the
 * fizz harmonic overtones. However, in addition to this behaviour, the resonant
 * high pass filter also emphasises/resonates the frequencies around the cutoff
 * point. The amount of emphasis is controlled by the rq param with a lower rq
 * resulting in greater resonance. High amounts of resonance (rq ~0) can create a
 * whistling sound around the cutoff frequency. High pass filters are rarely used
 * in the creation of instruments and are predominantly used to create
 * effervescent sound effects of bright timbres that can be laid over the top of
 * another low pass sound to increase the harmonic content.
 */
export class RHPF {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): RHPF {
    const b = new RHPF();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): RHPF {
    const b = new RHPF();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** cutoff frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * the reciprocal of Q. bandwidth / cutoffFreq. A lower rq results in more
   * resonance
   */
  rq(v: UGenInputLike): this {
    this._rq = toUGenInput(v);
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
    inputs.push(this._rq);
    const idx = def.addUgen("RHPF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Ringz is the same as Resonz, except that instead of a resonance parameter, the
 * bandwidth is specified in a 60dB ring decay time. One Ringz is equivalent to
 * one component of the klank ugen
 */
export class Ringz {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _decayTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Ringz {
    const b = new Ringz();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Ringz {
    const b = new Ringz();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._decayTime = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** resonant frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the 60 dB decay time of the filter */
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
    inputs.push(this._freq);
    inputs.push(this._decayTime);
    const idx = def.addUgen("Ringz", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * resonant low pass filter
 * 
 * A resonant low pass filter is a standard subtractive synthesis tool which
 * removes frequencies above a defined cut-off point. This typically has the
 * effect of making bright sounds duller. However, in addition to this behaviour,
 * the resonant low pass filter also emphasises/resonates the frequencies around
 * the cutoff point. The amount of emphasis is controlled by the rq param with a
 * lower rq resulting in greater resonance. High amounts of resonance (rq ~0) can
 * create a whistling sound around the cutoff frequency. Using a low pass filter
 * allows you to have fine-grained control of the level of brightness/dullness to
 * tune your timbre in addition to allowing you to modulate the effect in real
 * time thus creating movement in the sound.
 */
export class RLPF {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): RLPF {
    const b = new RLPF();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): RLPF {
    const b = new RLPF();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** cutoff frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * the reciprocal of Q. bandwidth / cutoffFreq. A lower rq results in more
   * resonance.
   */
  rq(v: UGenInputLike): this {
    this._rq = toUGenInput(v);
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
    inputs.push(this._rq);
    const idx = def.addUgen("RLPF", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Smooth the curve by limiting the slope of the input signal to up and dn */
export class Slew {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _up!: UGenInput;
  private _dn!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Slew {
    const b = new Slew();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._up = { tag: 'constant', val: 1 };
    b._dn = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Slew {
    const b = new Slew();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._up = { tag: 'constant', val: 1 };
    b._dn = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** maximum upward slope */
  up(v: UGenInputLike): this {
    this._up = toUGenInput(v);
    return this;
  }

  /** maximum downward slope */
  dn(v: UGenInputLike): this {
    this._dn = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._up);
    inputs.push(this._dn);
    const idx = def.addUgen("Slew", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Measures the rate of change per second of a signal. Formula implemented is:
 * out[i] = (in[i] - in[i-1]) * sampling_rate
 */
export class Slope {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Slope {
    const b = new Slope();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Slope {
    const b = new Slope();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal to measure */
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
    const idx = def.addUgen("Slope", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * second order filter section (biquad). Formula is equivalent to: out(i) = (a0 *
 * in(i)) + (a1 * in(i-1)) + (a2 * in(i-2)) + (b1 * out(i-1)) + (b2 * out(i-2))
 */
export class SOS {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _a0!: UGenInput;
  private _a1!: UGenInput;
  private _a2!: UGenInput;
  private _b1!: UGenInput;
  private _b2!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): SOS {
    const b = new SOS();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._a0 = { tag: 'constant', val: 0 };
    b._a1 = { tag: 'constant', val: 0 };
    b._a2 = { tag: 'constant', val: 0 };
    b._b1 = { tag: 'constant', val: 0 };
    b._b2 = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): SOS {
    const b = new SOS();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._a0 = { tag: 'constant', val: 0 };
    b._a1 = { tag: 'constant', val: 0 };
    b._a2 = { tag: 'constant', val: 0 };
    b._b1 = { tag: 'constant', val: 0 };
    b._b2 = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 1st coefficient */
  a0(v: UGenInputLike): this {
    this._a0 = toUGenInput(v);
    return this;
  }

  /** 2nd coefficient */
  a1(v: UGenInputLike): this {
    this._a1 = toUGenInput(v);
    return this;
  }

  /** 3rd coefficient */
  a2(v: UGenInputLike): this {
    this._a2 = toUGenInput(v);
    return this;
  }

  /** 4th coefficient */
  b1(v: UGenInputLike): this {
    this._b1 = toUGenInput(v);
    return this;
  }

  /** 5th coefficient */
  b2(v: UGenInputLike): this {
    this._b2 = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._a0);
    inputs.push(this._a1);
    inputs.push(this._a2);
    inputs.push(this._b1);
    inputs.push(this._b2);
    const idx = def.addUgen("SOS", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a two pole filter. This provides lower level access to setting of pole
 * location. For general purposes Resonz is better.
 */
export class TwoPole {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _radius!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): TwoPole {
    const b = new TwoPole();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._radius = { tag: 'constant', val: 0.8 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): TwoPole {
    const b = new TwoPole();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._radius = { tag: 'constant', val: 0.8 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** frequency of pole angle */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** radius of pole. Should be between 0 and +1 */
  radius(v: UGenInputLike): this {
    this._radius = toUGenInput(v);
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
    inputs.push(this._radius);
    const idx = def.addUgen("TwoPole", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** a two zero filter */
export class TwoZero {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _radius!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): TwoZero {
    const b = new TwoZero();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._radius = { tag: 'constant', val: 0.8 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): TwoZero {
    const b = new TwoZero();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._radius = { tag: 'constant', val: 0.8 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** frequency of zero angle */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** radius of zero */
  radius(v: UGenInputLike): this {
    this._radius = toUGenInput(v);
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
    inputs.push(this._radius);
    const idx = def.addUgen("TwoZero", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
