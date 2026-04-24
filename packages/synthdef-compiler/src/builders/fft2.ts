// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Strict convolution of two continuously changing inputs. Also see convolution2
 * for a cheaper CPU cost alternative for the case of a fixed kernel which can be
 * changed with a trigger message. See Steven W Smith, The Scientist and
 * Engineer's Guide to Digital Signal Processing: chapter 18: http://
 * www.dspguide.com/ch18.htm
 */
export class Convolution {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _kernel!: UGenInput;
  private _framesize!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Convolution {
    const b = new Convolution();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._kernel = { tag: 'constant', val: 0 };
    b._framesize = { tag: 'constant', val: 512 };
    return b;
  }

  /** processing target */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** processing kernel. */
  kernel(v: UGenInputLike): this {
    this._kernel = toUGenInput(v);
    return this;
  }

  /** size of FFT frame, must be a power of two */
  framesize(v: UGenInputLike): this {
    this._framesize = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._kernel);
    inputs.push(this._framesize);
    const idx = def.addUgen("Convolution", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Strict convolution with fixed kernel which can be updated using a trigger
 * signal. See Steven W Smith, The Scientist and Engineer's Guide to Digital
 * Signal Processing: chapter 18: http:// www.dspguide.com/ch18.htm
 */
export class Convolution2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _kernel!: UGenInput;
  private _trigger!: UGenInput;
  private _framesize!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Convolution2 {
    const b = new Convolution2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._kernel = { tag: 'constant', val: 0 };
    b._trigger = { tag: 'constant', val: 0 };
    b._framesize = { tag: 'constant', val: 512 };
    return b;
  }

  /** processing target */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * buffer index for the fixed kernel, may be modulated in combination with the
   * trigger
   */
  kernel(v: UGenInputLike): this {
    this._kernel = toUGenInput(v);
    return this;
  }

  /** update the kernel on a change from <= 0 to > 0 */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /**
   * size of FFT frame, must be a power of two. Convolution uses twice this number
   * internally, maximum value you can give this argument is 2^16 = 65536. Note
   * that it gets progressively more expensive to run for higher powers! 512, 1024,
   * 2048, 4096 standard.
   */
  framesize(v: UGenInputLike): this {
    this._framesize = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._kernel);
    inputs.push(this._trigger);
    inputs.push(this._framesize);
    const idx = def.addUgen("Convolution2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Strict convolution with fixed kernel which can be updated using a trigger
 * signal. There is a linear crossfade between the buffers upon change. See
 * Steven W Smith, The Scientist and Engineer's Guide to Digital Signal
 * Processing: chapter 18: http://www.dspguide.com/ch18.htm
 */
export class Convolution2L {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _kernel!: UGenInput;
  private _trigger!: UGenInput;
  private _framesize!: UGenInput;
  private _crossfade!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Convolution2L {
    const b = new Convolution2L();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._kernel = { tag: 'constant', val: 0 };
    b._trigger = { tag: 'constant', val: 0 };
    b._framesize = { tag: 'constant', val: 512 };
    b._crossfade = { tag: 'constant', val: 1 };
    return b;
  }

  /** processing target */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * buffer index for the fixed kernel, may be modulated in combination with the
   * trigger
   */
  kernel(v: UGenInputLike): this {
    this._kernel = toUGenInput(v);
    return this;
  }

  /** update the kernel on a change from <= 0 to > 0 */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /**
   * size of FFT frame, must be a power of two. Convolution uses twice this number
   * internally, maximum value you can give this argument is 2^16=65536. Note that
   * it gets progressively more expensive to run for higher powers! 512, 1024,
   * 2048, 4096 standard.
   */
  framesize(v: UGenInputLike): this {
    this._framesize = toUGenInput(v);
    return this;
  }

  /**
   * The number of periods over which a crossfade is made. The default is 1. This
   * must be an integer.
   */
  crossfade(v: UGenInputLike): this {
    this._crossfade = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._kernel);
    inputs.push(this._trigger);
    inputs.push(this._framesize);
    inputs.push(this._crossfade);
    const idx = def.addUgen("Convolution2L", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Strict convolution with fixed kernel which can be updated using a trigger
 * signal. The convolution is performed in the time domain, which is highly
 * inefficient, and probably only useful for either very short kernel sizes, or
 * for control rate signals.
 */
export class Convolution3 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _kernel!: UGenInput;
  private _trigger!: UGenInput;
  private _framesize!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Convolution3 {
    const b = new Convolution3();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._kernel = { tag: 'constant', val: 0 };
    b._trigger = { tag: 'constant', val: 0 };
    b._framesize = { tag: 'constant', val: 512 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Convolution3 {
    const b = new Convolution3();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._kernel = { tag: 'constant', val: 0 };
    b._trigger = { tag: 'constant', val: 0 };
    b._framesize = { tag: 'constant', val: 512 };
    return b;
  }

  /** processing target */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * buffer index for the fixed kernel, may be modulated in combination with the
   * trigger
   */
  kernel(v: UGenInputLike): this {
    this._kernel = toUGenInput(v);
    return this;
  }

  /** update the kernel on a change from <= 0 to > 0 */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /** size of FFT frame, does not have to be a power of two. */
  framesize(v: UGenInputLike): this {
    this._framesize = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._kernel);
    inputs.push(this._trigger);
    inputs.push(this._framesize);
    const idx = def.addUgen("Convolution3", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Applies the conformal mapping z -> (z-a)/(1-za*) to the phase vocoder bins z
 * with a given by the real and imag inputs to the UGen. i.e., makes a
 * transformation of the complex plane so the output is full of phase vocoder
 * artifacts but may be musically fun. Usually keep |a|<1 but you can of course
 * try bigger values to make it really noisy. a=0 should give back the input
 * mostly unperturbed. See http://mathworld.wolfram.com/ConformalMapping.html
 */
export class PV_ConformalMap {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _areal!: UGenInput;
  private _aimag!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_ConformalMap {
    const b = new PV_ConformalMap();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._areal = { tag: 'constant', val: 0 };
    b._aimag = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * buffer number of buffer to act on, passed in through a chain (see examples
   * below).
   */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** real part of a. */
  areal(v: UGenInputLike): this {
    this._areal = toUGenInput(v);
    return this;
  }

  /** imaginary part of a. */
  aimag(v: UGenInputLike): this {
    this._aimag = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._areal);
    inputs.push(this._aimag);
    const idx = def.addUgen("PV_ConformalMap", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * FFT onset detector based on work described in: Hainsworth, S. (2003)
 * Techniques for the Automated Analysis of Musical Audio. PhD, University of
 * Cambridge engineering dept. See especially p128. The Hainsworth metric is a
 * modification of the Kullback Liebler distance. The onset detector has general
 * ability to spot spectral change, so may have some ability to track chord
 * changes aside from obvious transient jolts, but there's no guarantee it won't
 * be confused by frequency modulation artifacts. Hainsworth metric on it's own
 * gives good results but Foote might be useful in some situations: experimental.
 */
export class PV_HainsworthFoote {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _proph!: UGenInput;
  private _propf!: UGenInput;
  private _threshold!: UGenInput;
  private _waitTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PV_HainsworthFoote {
    const b = new PV_HainsworthFoote();
    b._calcRate = 'audio';
    b._buffer = { tag: 'constant', val: 0 };
    b._proph = { tag: 'constant', val: 0 };
    b._propf = { tag: 'constant', val: 0 };
    b._threshold = { tag: 'constant', val: 1 };
    b._waitTime = { tag: 'constant', val: 0.04 };
    return b;
  }

  /** FFT buffer to read from */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** What strength of detection signal from Hainsworth metric to use. */
  proph(v: UGenInputLike): this {
    this._proph = toUGenInput(v);
    return this;
  }

  /**
   * What strength of detection signal from Foote metric to use. The Foote metric
   * is normalised to [0.0,1.0]
   */
  propf(v: UGenInputLike): this {
    this._propf = toUGenInput(v);
    return this;
  }

  /** Threshold hold level for allowing a detection */
  threshold(v: UGenInputLike): this {
    this._threshold = toUGenInput(v);
    return this;
  }

  /**
   * If triggered, minimum wait until a further frame can cause another spot
   * (useful to stop multiple detects on heavy signals)
   */
  waitTime(v: UGenInputLike): this {
    this._waitTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._proph);
    inputs.push(this._propf);
    inputs.push(this._threshold);
    inputs.push(this._waitTime);
    const idx = def.addUgen("PV_HainsworthFoote", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * FFT feature detector for onset detection based on work described in: Jensen,K.
 * & Andersen, T. H. (2003). Real-time Beat Estimation Using Feature Extraction.
 * In Proceedings of the Computer Music Modeling and Retrieval Symposium, Lecture
 * Notes in Computer Science. Springer Verlag. First order derivatives of the
 * features are taken. Threshold may need to be set low to pick up on changes.
 */
export class PV_JensenAndersen {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _propsc!: UGenInput;
  private _prophfe!: UGenInput;
  private _prophfc!: UGenInput;
  private _propsf!: UGenInput;
  private _threshold!: UGenInput;
  private _waitTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PV_JensenAndersen {
    const b = new PV_JensenAndersen();
    b._calcRate = 'audio';
    b._buffer = { tag: 'constant', val: 0 };
    b._propsc = { tag: 'constant', val: 0.25 };
    b._prophfe = { tag: 'constant', val: 0.25 };
    b._prophfc = { tag: 'constant', val: 0.25 };
    b._propsf = { tag: 'constant', val: 0.25 };
    b._threshold = { tag: 'constant', val: 1 };
    b._waitTime = { tag: 'constant', val: 0.04 };
    return b;
  }

  /** FFT buffer to read from. */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** Proportion of spectral centroid feature. */
  propsc(v: UGenInputLike): this {
    this._propsc = toUGenInput(v);
    return this;
  }

  /** Proportion of high frequency energy feature. */
  prophfe(v: UGenInputLike): this {
    this._prophfe = toUGenInput(v);
    return this;
  }

  /** Proportion of high frequency content feature. */
  prophfc(v: UGenInputLike): this {
    this._prophfc = toUGenInput(v);
    return this;
  }

  /** Proportion of spectral flux feature. */
  propsf(v: UGenInputLike): this {
    this._propsf = toUGenInput(v);
    return this;
  }

  /** Threshold level for allowing a detection */
  threshold(v: UGenInputLike): this {
    this._threshold = toUGenInput(v);
    return this;
  }

  /**
   * If triggered, minimum wait until a further frame can cause another spot
   * (useful to stop multiple detects on heavy signals)
   */
  waitTime(v: UGenInputLike): this {
    this._waitTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._propsc);
    inputs.push(this._prophfe);
    inputs.push(this._prophfc);
    inputs.push(this._propsf);
    inputs.push(this._threshold);
    inputs.push(this._waitTime);
    const idx = def.addUgen("PV_JensenAndersen", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A running sum over a user specified number of samples, useful for running RMS
 * power windowing.
 */
export class RunningSum {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _numsamp!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): RunningSum {
    const b = new RunningSum();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._numsamp = { tag: 'constant', val: 40 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): RunningSum {
    const b = new RunningSum();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._numsamp = { tag: 'constant', val: 40 };
    return b;
  }

  /** Input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * How many samples to take the running sum over (initialisation time only, not
   * modulatable.
   */
  numsamp(v: UGenInputLike): this {
    this._numsamp = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._numsamp);
    const idx = def.addUgen("RunningSum", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Strict convolution with fixed kernel which can be updated using a trigger
 * signal. There is a linear crossfade between the buffers upon change. Like
 * convolution2L, but convolves with two buffers and outputs a stereo signal.
 * This saves one FFT transformation per period, as compared to using two copies
 * of convolution2L. Useful applications could include stereo reverberation or
 * HRTF convolution. See Steven W Smith, The Scientist and Engineer's Guide to
 * Digital Signal Processing: chapter 18: http://www.dspguide.com/ch18.htm
 */
export class StereoConvolution2L {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _kernelL!: UGenInput;
  private _kernelR!: UGenInput;
  private _trigger!: UGenInput;
  private _framesize!: UGenInput;
  private _crossfade!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): StereoConvolution2L {
    const b = new StereoConvolution2L();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._kernelL = { tag: 'constant', val: 0 };
    b._kernelR = { tag: 'constant', val: 0 };
    b._trigger = { tag: 'constant', val: 0 };
    b._framesize = { tag: 'constant', val: 512 };
    b._crossfade = { tag: 'constant', val: 1 };
    return b;
  }

  /** processing target */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * buffer index for the fixed kernel of the left channel, may be modulated in
   * combination with the trigger
   */
  kernelL(v: UGenInputLike): this {
    this._kernelL = toUGenInput(v);
    return this;
  }

  /**
   * buffer index for the fixed kernel of the right channel, may be modulated in
   * combination with the trigger
   */
  kernelR(v: UGenInputLike): this {
    this._kernelR = toUGenInput(v);
    return this;
  }

  /** update the kernel on a change from <= 0 to > 0 */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /**
   * size of FFT frame, must be a power of two. Convolution uses twice this number
   * internally, maximum value you can give this argument is 2^16=65536. Note that
   * it gets progressively more expensive to run for higher powers! 512, 1024,
   * 2048, 4096 standard.
   */
  framesize(v: UGenInputLike): this {
    this._framesize = toUGenInput(v);
    return this;
  }

  /** The number of periods over which a crossfade is made. This must be an integer. */
  crossfade(v: UGenInputLike): this {
    this._crossfade = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._kernelL);
    inputs.push(this._kernelR);
    inputs.push(this._trigger);
    inputs.push(this._framesize);
    inputs.push(this._crossfade);
    const idx = def.addUgen("StereoConvolution2L", this._calcRate, inputs, 2, 0);
    return { tag: 'ugen', val: idx };
  }
}
