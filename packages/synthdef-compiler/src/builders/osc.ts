// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Chorusing wavetable lookup oscillator. Produces sum of two signals at (freq
 * +/- (beats / 2)). Due to summing, the peak amplitude is twice that of the
 * wavetable.
 */
export class COsc {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _freq!: UGenInput;
  private _beats!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): COsc {
    const b = new COsc();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._beats = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): COsc {
    const b = new COsc();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._beats = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** The number of a buffer filled in wavetable format */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Beat frequency in Hertz */
  beats(v: UGenInputLike): this {
    this._beats = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufnum);
    inputs.push(this._freq);
    inputs.push(this._beats);
    const idx = def.addUgen("COsc", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * the input signal value is truncated to an integer value and used as an index
 * into an octave repeating table of note values (indices wrap around the table)
 */
export class DegreeToKey {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _in!: UGenInput;
  private _octave!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DegreeToKey {
    const b = new DegreeToKey();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._octave = { tag: 'constant', val: 12 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DegreeToKey {
    const b = new DegreeToKey();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._octave = { tag: 'constant', val: 12 };
    return b;
  }

  /** Index of the buffer which contains the steps for each scale degree. */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /** The input signal. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** The number of steps per octave in the scale. The default is 12. */
  octave(v: UGenInputLike): this {
    this._octave = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufnum);
    inputs.push(this._in);
    inputs.push(this._octave);
    const idx = def.addUgen("DegreeToKey", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** search a buffer for a value */
export class DetectIndex {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): DetectIndex {
    const b = new DetectIndex();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): DetectIndex {
    const b = new DetectIndex();
    b._calcRate = 'scalar';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
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
    inputs.push(this._bufnum);
    inputs.push(this._in);
    const idx = def.addUgen("DetectIndex", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates a set of harmonics around a formant frequency at a given fundamental
 * frequency. The frequency inputs are read at control rate only, so if you use
 * an audio rate UGen as an input, it will only be sampled at the start of each
 * audio synthesis block.
 */
export class Formant {
  private _calcRate!: Rate;
  private _fundfreq!: UGenInput;
  private _formfreq!: UGenInput;
  private _bwfreq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Formant {
    const b = new Formant();
    b._calcRate = 'audio';
    b._fundfreq = { tag: 'constant', val: 440 };
    b._formfreq = { tag: 'constant', val: 1760 };
    b._bwfreq = { tag: 'constant', val: 880 };
    return b;
  }

  /** Fundamental frequency in Hertz (control rate) */
  fundfreq(v: UGenInputLike): this {
    this._fundfreq = toUGenInput(v);
    return this;
  }

  /** Formant frequency in Hertz (control rate) */
  formfreq(v: UGenInputLike): this {
    this._formfreq = toUGenInput(v);
    return this;
  }

  /**
   * Pulse width frequency in Hertz. Controls the bandwidth of the formant (control
   * rate)
   */
  bwfreq(v: UGenInputLike): this {
    this._bwfreq = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._fundfreq);
    inputs.push(this._formfreq);
    inputs.push(this._bwfreq);
    const idx = def.addUgen("Formant", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * non band limited impulse oscillator. Outputs a single 1 every freq cycles per
 * second and 0 the rest of the time.
 */
export class Impulse {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _phase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Impulse {
    const b = new Impulse();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._phase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Impulse {
    const b = new Impulse();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._phase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Phase offset in cycles ( 0..1 ) */
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
    inputs.push(this._freq);
    inputs.push(this._phase);
    const idx = def.addUgen("Impulse", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * the input signal value is truncated to an integer and used as an index into
 * the table
 */
export class Index {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): Index {
    const b = new Index();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): Index {
    const b = new Index();
    b._calcRate = 'scalar';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
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
    inputs.push(this._bufnum);
    inputs.push(this._in);
    const idx = def.addUgen("Index", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * finds the (lowest) point in the buffer at which the input signal lies
 * in-between the two values, and returns the index
 */
export class IndexInBetween {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): IndexInBetween {
    const b = new IndexInBetween();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): IndexInBetween {
    const b = new IndexInBetween();
    b._calcRate = 'scalar';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
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
    inputs.push(this._bufnum);
    inputs.push(this._in);
    const idx = def.addUgen("IndexInBetween", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** an oscillator outputting a sine like shape made of two cubic pieces */
export class LFCub {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _iphase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFCub {
    const b = new LFCub();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFCub {
    const b = new LFCub();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * Initial phase offset. For efficiency reasons this is a value ranging from 0 to
   * 2.
   */
  iphase(v: UGenInputLike): this {
    this._iphase = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._iphase);
    const idx = def.addUgen("LFCub", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A non-band-limited gaussian function oscillator. Output ranges from minval to
 * 1. LFGauss implements the formula: f(x) = exp(squared(x - iphase) / (-2.0 *
 * squared(width))) where x is to vary in the range -1 to 1 over the period dur.
 * minval is the initial value at -1
 */
export class LFGauss {
  private _calcRate!: Rate;
  private _duration!: UGenInput;
  private _width!: UGenInput;
  private _iphase!: UGenInput;
  private _loop!: UGenInput;
  private _action!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFGauss {
    const b = new LFGauss();
    b._calcRate = 'audio';
    b._duration = { tag: 'constant', val: 1 };
    b._width = { tag: 'constant', val: 0.1 };
    b._iphase = { tag: 'constant', val: 0 };
    b._loop = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFGauss {
    const b = new LFGauss();
    b._calcRate = 'control';
    b._duration = { tag: 'constant', val: 1 };
    b._width = { tag: 'constant', val: 0.1 };
    b._iphase = { tag: 'constant', val: 0 };
    b._loop = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Duration of one full cycle ( for freq input: dur = 1 / freq ) */
  duration(v: UGenInputLike): this {
    this._duration = toUGenInput(v);
    return this;
  }

  /** Relative width of the bell. Best to keep below 0.25 when used as envelope. */
  width(v: UGenInputLike): this {
    this._width = toUGenInput(v);
    return this;
  }

  /** Initial offset */
  iphase(v: UGenInputLike): this {
    this._iphase = toUGenInput(v);
    return this;
  }

  /**
   * If loop is > 0, UGen oscillates. Otherwise it calls the done action after one
   * cycle
   */
  loop(v: UGenInputLike): this {
    this._loop = toUGenInput(v);
    return this;
  }

  /** Action to be evaluated after cycle completes. Default: NO-ACTION. */
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
    inputs.push(this._duration);
    inputs.push(this._width);
    inputs.push(this._iphase);
    inputs.push(this._loop);
    inputs.push(this._action);
    const idx = def.addUgen("LFGauss", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a non band-limited parabolic oscillator outputing a high of 1 and a low of
 * zero.
 */
export class LFPar {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _iphase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFPar {
    const b = new LFPar();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFPar {
    const b = new LFPar();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * Initial phase offset. For efficiency reasons this is a value ranging from 0 to
   * 2.
   */
  iphase(v: UGenInputLike): this {
    this._iphase = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._iphase);
    const idx = def.addUgen("LFPar", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A non-band-limited pulse oscillator. Outputs a high value of one and a low
 * value of zero.
 */
export class LFPulse {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _iphase!: UGenInput;
  private _width!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFPulse {
    const b = new LFPulse();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    b._width = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFPulse {
    const b = new LFPulse();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    b._width = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Initial phase offset in cycles ( 0..1 ) */
  iphase(v: UGenInputLike): this {
    this._iphase = toUGenInput(v);
    return this;
  }

  /** Pulse width duty cycle from zero to one */
  width(v: UGenInputLike): this {
    this._width = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._iphase);
    inputs.push(this._width);
    const idx = def.addUgen("LFPulse", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** low freq (i.e. not band limited) sawtooth oscillator */
export class LFSaw {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _iphase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFSaw {
    const b = new LFSaw();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFSaw {
    const b = new LFSaw();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * Initial phase offset. For efficiency reasons this is a value ranging from 0 to
   * 2.
   */
  iphase(v: UGenInputLike): this {
    this._iphase = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._iphase);
    const idx = def.addUgen("LFSaw", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * a non-band-limited triangle oscillator
 * 
 * The triangle wave shape features two linear slopes and is not as harmonically
 * rich as a sawtooth wave since it only contains odd harmonics (partials).
 * Ideally, this type of wave form is mixed with a sine, square or pulse wave to
 * add a sparkling or bright effect to a sound and is often employed on pads to
 * give them a glittery feel.
 */
export class LFTri {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _iphase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFTri {
    const b = new LFTri();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFTri {
    const b = new LFTri();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * Initial phase offset. For efficiency reasons this is a value ranging from 0 to
   * 2.
   */
  iphase(v: UGenInputLike): this {
    this._iphase = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._iphase);
    const idx = def.addUgen("LFTri", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Linear interpolating wavetable lookup oscillator with frequency and phase
 * modulation inputs. This oscillator requires a buffer to be filled with a
 * wavetable format signal. This preprocesses the Signal into a form which can be
 * used efficiently by the Oscillator. The buffer size must be a power of 2. This
 * can be achieved by creating a Buffer object and sending it one of the b_gen
 * messages (sine1, sine2, sine3) with the wavetable flag set to true. This can
 * also be achieved by creating a Signal object and sending it the 'asWavetable'
 * message, saving it to disk, and having the server load it from there.
 */
export class Osc {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _freq!: UGenInput;
  private _phase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Osc {
    const b = new Osc();
    b._calcRate = 'audio';
    b._buffer = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._phase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Osc {
    const b = new Osc();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._phase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Lookup buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Phase offset or modulator in radians */
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
    inputs.push(this._buffer);
    inputs.push(this._freq);
    inputs.push(this._phase);
    const idx = def.addUgen("Osc", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** select the output signal from an array of inputs */
export class Select {
  private _calcRate!: Rate;
  private _which!: UGenInput;
  private _channelsArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Select {
    const b = new Select();
    b._calcRate = 'audio';
    b._which = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Select {
    const b = new Select();
    b._calcRate = 'control';
    b._which = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /** Index of array to select */
  which(v: UGenInputLike): this {
    this._which = toUGenInput(v);
    return this;
  }

  /** List of ugens to choose from */
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
    inputs.push(this._which);
    inputs.push(...this._channelsArray);
    const idx = def.addUgen("Select", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** performs waveshaping on the input signal by indexing into a table */
export class Shaper {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): Shaper {
    const b = new Shaper();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): Shaper {
    const b = new Shaper();
    b._calcRate = 'scalar';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
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
    inputs.push(this._bufnum);
    inputs.push(this._in);
    const idx = def.addUgen("Shaper", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Sine table lookup oscillator
 * 
 * Outputs a sine wave with values oscillating between -1 and 1 similar to osc
 * except that the table has already been fixed as a sine table of 8192 entries.
 * Sine waves are often used for creating sub-basses or are mixed with other
 * waveforms to add extra body or bottom end to a sound. They contain no
 * harmonics and consist entirely of the fundamental frequency. This means that
 * they're not suitable for subtractive synthesis i.e. passing through filters
 * such as a hpf or lpf. However, they are useful for additive synthesis i.e.
 * adding multiple sine waves together at different frequencies, amplitudes and
 * phase to create new timbres.
 */
export class SinOsc {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _phase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): SinOsc {
    const b = new SinOsc();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._phase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): SinOsc {
    const b = new SinOsc();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._phase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Phase offset or modulator in radians */
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
    inputs.push(this._freq);
    inputs.push(this._phase);
    const idx = def.addUgen("SinOsc", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Sine oscillator with phase modulation feedback
 * 
 * Different feedback values results in a modulation between a sine wave and a
 * sawtooth like wave. Overmodulation causes chaotic oscillation.
 */
export class SinOscFB {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _feedback!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): SinOscFB {
    const b = new SinOscFB();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._feedback = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): SinOscFB {
    const b = new SinOscFB();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._feedback = { tag: 'constant', val: 0 };
    return b;
  }

  /** Frequency of oscillator */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** amplitude of phase feedback in radians */
  feedback(v: UGenInputLike): this {
    this._feedback = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._feedback);
    const idx = def.addUgen("SinOscFB", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * hard sync sawtooth wave oscillator
 * 
 * A sawtooth wave that is hard synched to a fundamental pitch. This produces an
 * effect similar to moving formants or pulse width modulation. The sawtooth
 * oscillator has its phase reset when the sync oscillator completes a cycle.
 * This is not a band limited waveform, so it may alias.
 */
export class SyncSaw {
  private _calcRate!: Rate;
  private _syncFreq!: UGenInput;
  private _sawFreq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): SyncSaw {
    const b = new SyncSaw();
    b._calcRate = 'audio';
    b._syncFreq = { tag: 'constant', val: 440 };
    b._sawFreq = { tag: 'constant', val: 440 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): SyncSaw {
    const b = new SyncSaw();
    b._calcRate = 'control';
    b._syncFreq = { tag: 'constant', val: 440 };
    b._sawFreq = { tag: 'constant', val: 440 };
    return b;
  }

  /** Frequency of the fundamental. */
  syncFreq(v: UGenInputLike): this {
    this._syncFreq = toUGenInput(v);
    return this;
  }

  /**
   * Frequency of the slave synched sawtooth wave. saw-freq should always be
   * greater than sync-freq.
   */
  sawFreq(v: UGenInputLike): this {
    this._sawFreq = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._syncFreq);
    inputs.push(this._sawFreq);
    const idx = def.addUgen("SyncSaw", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** a variable duty cycle saw wave oscillator */
export class VarSaw {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _iphase!: UGenInput;
  private _width!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): VarSaw {
    const b = new VarSaw();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    b._width = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): VarSaw {
    const b = new VarSaw();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    b._width = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Initial phase offset in cycles ( 0..1 ) */
  iphase(v: UGenInputLike): this {
    this._iphase = toUGenInput(v);
    return this;
  }

  /**
   * Duty cycle from zero to one. (0 = downward sawtooth, 0.5 = triangle, 1 =
   * upward sawtooth)
   */
  width(v: UGenInputLike): this {
    this._width = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._iphase);
    inputs.push(this._width);
    const idx = def.addUgen("VarSaw", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Models a slow frequency modulation.
 * 
 * Vibrato is a slow frequency modulation. Consider the systematic deviation in
 * pitch of a singer around a fundamental frequency, or a violinist whose finger
 * wobbles in position on the fingerboard, slightly tightening and loosening the
 * string to add shimmer to the pitch. There is often also a delay before vibrato
 * is established on a note. This UGen models these processes; by setting more
 * extreme settings, you can get back to the timbres of FM synthesis. You can
 * also add in some noise to the vibrato rate and vibrato size (modulation depth)
 * to make for a more realistic motor pattern. The vibrato output is a waveform
 * based on a squared envelope shape with four stages marking out 0.0 to 1.0, 1.0
 * to 0.0, 0.0 to -1.0, and -1.0 back to 0.0. Vibrato rate determines how quickly
 * you move through these stages.
 */
export class Vibrato {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _rate!: UGenInput;
  private _depth!: UGenInput;
  private _delay!: UGenInput;
  private _onset!: UGenInput;
  private _rateVariation!: UGenInput;
  private _depthVariation!: UGenInput;
  private _iphase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Vibrato {
    const b = new Vibrato();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._rate = { tag: 'constant', val: 6 };
    b._depth = { tag: 'constant', val: 0.02 };
    b._delay = { tag: 'constant', val: 0 };
    b._onset = { tag: 'constant', val: 0 };
    b._rateVariation = { tag: 'constant', val: 0.04 };
    b._depthVariation = { tag: 'constant', val: 0.1 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Vibrato {
    const b = new Vibrato();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._rate = { tag: 'constant', val: 6 };
    b._depth = { tag: 'constant', val: 0.02 };
    b._delay = { tag: 'constant', val: 0 };
    b._onset = { tag: 'constant', val: 0 };
    b._rateVariation = { tag: 'constant', val: 0.04 };
    b._depthVariation = { tag: 'constant', val: 0.1 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * Fundamental frequency in Hertz. If the Vibrato UGen is running at audio rate,
   * this must not be a constant, but an actual audio rate UGen
   */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * Vibrato rate, speed of wobble in Hertz. Note that if this is set to a low
   * value (and definitely with 0.0), you may never get vibrato back, since the
   * rate input is only checked at the end of a cycle.
   */
  rate(v: UGenInputLike): this {
    this._rate = toUGenInput(v);
    return this;
  }

  /**
   * Size of vibrato frequency deviation around the fundamental, as a proportion of
   * the fundamental. 0.02 = 2% of the fundamental.
   */
  depth(v: UGenInputLike): this {
    this._depth = toUGenInput(v);
    return this;
  }

  /**
   * Delay before vibrato is established in seconds (a singer tends to attack a
   * note and then stabilise with vibrato, for instance).
   */
  delay(v: UGenInputLike): this {
    this._delay = toUGenInput(v);
    return this;
  }

  /**
   * Transition time in seconds from no vibrato to full vibrato after the initial
   * delay time.
   */
  onset(v: UGenInputLike): this {
    this._onset = toUGenInput(v);
    return this;
  }

  /**
   * Noise on the rate, expressed as a proportion of the rate; can change once per
   * cycle of vibrato.
   */
  rateVariation(v: UGenInputLike): this {
    this._rateVariation = toUGenInput(v);
    return this;
  }

  /**
   * Noise on the depth of modulation, expressed as a proportion of the depth; can
   * change once per cycle of vibrato. The noise affects independently the up and
   * the down part of vibrato shape within a cycle.
   */
  depthVariation(v: UGenInputLike): this {
    this._depthVariation = toUGenInput(v);
    return this;
  }

  /**
   * Initial phase of vibrato modulation, allowing starting above or below the
   * fundamental rather than on it.
   */
  iphase(v: UGenInputLike): this {
    this._iphase = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._rate);
    inputs.push(this._depth);
    inputs.push(this._delay);
    inputs.push(this._onset);
    inputs.push(this._rateVariation);
    inputs.push(this._depthVariation);
    inputs.push(this._iphase);
    const idx = def.addUgen("Vibrato", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A wavetable lookup oscillator which can be swept smoothly across wavetables.
 * All the wavetables must be allocated to the same size. Fractional values of
 * table will interpolate between two adjacent tables. This oscillator requires
 * at least two buffers to be filled with a wavetable format signal. This
 * preprocesses the Signal into a form which can be used efficiently by the
 * Oscillator. The buffer size must be a power of 2.
 */
export class VOsc {
  private _calcRate!: Rate;
  private _bufpos!: UGenInput;
  private _freq!: UGenInput;
  private _phase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): VOsc {
    const b = new VOsc();
    b._calcRate = 'audio';
    b._bufpos = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._phase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): VOsc {
    const b = new VOsc();
    b._calcRate = 'control';
    b._bufpos = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 440 };
    b._phase = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * Buffer index. Can be swept continuously among adjacent wavetable buffers of
   * the same size.
   */
  bufpos(v: UGenInputLike): this {
    this._bufpos = toUGenInput(v);
    return this;
  }

  /** Frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Phase offset of modulator in radians */
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
    inputs.push(this._bufpos);
    inputs.push(this._freq);
    inputs.push(this._phase);
    const idx = def.addUgen("VOsc", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Three variable wavetable oscillators. A wavetable lookup oscillator which can
 * be swept smoothly across wavetables. All the wavetables must be allocated to
 * the same size. Fractional values of table will interpolate between two
 * adjacent tables. This unit generator contains three oscillators at different
 * frequencies, mixed together. This oscillator requires at least two buffers to
 * be filled with a wavetable format signal. This preprocesses the Signal into a
 * form which can be used efficiently by the Oscillator. The buffer size must be
 * a power of 2.
 */
export class VOsc3 {
  private _calcRate!: Rate;
  private _bufpos!: UGenInput;
  private _freq1!: UGenInput;
  private _freq2!: UGenInput;
  private _freq3!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): VOsc3 {
    const b = new VOsc3();
    b._calcRate = 'audio';
    b._bufpos = { tag: 'constant', val: 0 };
    b._freq1 = { tag: 'constant', val: 110 };
    b._freq2 = { tag: 'constant', val: 220 };
    b._freq3 = { tag: 'constant', val: 440 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): VOsc3 {
    const b = new VOsc3();
    b._calcRate = 'control';
    b._bufpos = { tag: 'constant', val: 0 };
    b._freq1 = { tag: 'constant', val: 110 };
    b._freq2 = { tag: 'constant', val: 220 };
    b._freq3 = { tag: 'constant', val: 440 };
    return b;
  }

  /**
   * Buffer index. Can be swept continuously among adjacent wavetable buffers of
   * the same size.
   */
  bufpos(v: UGenInputLike): this {
    this._bufpos = toUGenInput(v);
    return this;
  }

  /** Frequency in Hertz of first oscillator */
  freq1(v: UGenInputLike): this {
    this._freq1 = toUGenInput(v);
    return this;
  }

  /** Frequency in Hertz of second oscillator */
  freq2(v: UGenInputLike): this {
    this._freq2 = toUGenInput(v);
    return this;
  }

  /** Frequency in Hertz of third oscillator */
  freq3(v: UGenInputLike): this {
    this._freq3 = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufpos);
    inputs.push(this._freq1);
    inputs.push(this._freq2);
    inputs.push(this._freq3);
    const idx = def.addUgen("VOsc3", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * the input signal value is truncated to an integer value and used as an index
 * into the table (out of range index values are wrapped)
 */
export class WrapIndex {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): WrapIndex {
    const b = new WrapIndex();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): WrapIndex {
    const b = new WrapIndex();
    b._calcRate = 'scalar';
    b._bufnum = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    return b;
  }

  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
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
    inputs.push(this._bufnum);
    inputs.push(this._in);
    const idx = def.addUgen("WrapIndex", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
