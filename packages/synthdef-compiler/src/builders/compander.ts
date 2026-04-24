// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Amplitude follower
 * 
 * Tracks the peak amplitude of a signal.
 */
export class Amplitude {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _attackTime!: UGenInput;
  private _releaseTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Amplitude {
    const b = new Amplitude();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._attackTime = { tag: 'constant', val: 0.01 };
    b._releaseTime = { tag: 'constant', val: 0.01 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Amplitude {
    const b = new Amplitude();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._attackTime = { tag: 'constant', val: 0.01 };
    b._releaseTime = { tag: 'constant', val: 0.01 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** 60dB convergence time for following attacks */
  attackTime(v: UGenInputLike): this {
    this._attackTime = toUGenInput(v);
    return this;
  }

  /** 60dB convergence time for following decays */
  releaseTime(v: UGenInputLike): this {
    this._releaseTime = toUGenInput(v);
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
    inputs.push(this._releaseTime);
    const idx = def.addUgen("Amplitude", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * General purpose hard-knee dynamic range processor.
 * 
 * The compander will modify the amplitude of the in signal based on an analysis
 * of the control signal. Typically the in and control signals are the same. The
 * amplitude of the control signal is calcuated using RMS (Root Mean Square) and
 * the final amplitude of the in signal is calculated as a function of the
 * amplitude threshold, and slopes either side (below and above) with some
 * temporal modifications in terms of attack and release phases. It is a
 * hard-knee processor which means that the response curve is a sharp angle
 * rather than a rounded edge. If the control amplitude is less than the
 * threshold, the slope below is used to calculate the amplitude modification. If
 * this is steep (greater than 1) this will reduce the amplitude of quiet signals
 * (the quieter the control amplitude the greater the reduction affect). Values <
 * 1.0 are possible, but it means that a very low-level control signal will cause
 * the input signal to be amplified, which would raise the noise floor. If the
 * control amplitude is greater than the threshold, the slope above is used to
 * calculate the amplitude modification. If this is steep (greater than 1) this
 * will create expansion - loud signals will be made louder). Less than 1 will
 * achieve compressions (louder signals are attenuated). The clamp and relax
 * times modify when the amplitude modification takes place and ends. May be used
 * to define: compressers, expanders, limiters, gates and duckers. For more
 * information see: http://en.wikipedia.org/wiki/Audio_level_compression
 */
export class Compander {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _control!: UGenInput;
  private _thresh!: UGenInput;
  private _slopeBelow!: UGenInput;
  private _slopeAbove!: UGenInput;
  private _clampTime!: UGenInput;
  private _relaxTime!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Compander {
    const b = new Compander();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._control = { tag: 'constant', val: 0 };
    b._thresh = { tag: 'constant', val: 0.5 };
    b._slopeBelow = { tag: 'constant', val: 1 };
    b._slopeAbove = { tag: 'constant', val: 1 };
    b._clampTime = { tag: 'constant', val: 0.01 };
    b._relaxTime = { tag: 'constant', val: 0.1 };
    return b;
  }

  /** The signal to be compressed / expanded / gated */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * The signal whose amplitude determines the gain applied to the input signal.
   * Often the same as in (for standard gating or compression) but should be
   * different for ducking.
   */
  control(v: UGenInputLike): this {
    this._control = toUGenInput(v);
    return this;
  }

  /**
   * Control signal amplitude threshold, which determines the break point between
   * slope-below and slope-above. Typically a value between 0 and 1.
   */
  thresh(v: UGenInputLike): this {
    this._thresh = toUGenInput(v);
    return this;
  }

  /**
   * Slope of the amplitude curve below the threshold. A value of 1 means the
   * output amplitude will match the control signal amplitude.
   */
  slopeBelow(v: UGenInputLike): this {
    this._slopeBelow = toUGenInput(v);
    return this;
  }

  /**
   * Slope of the amplitude curve above the threshold. A value of 1 means the
   * output amplitude will match the control signal amplitude.
   */
  slopeAbove(v: UGenInputLike): this {
    this._slopeAbove = toUGenInput(v);
    return this;
  }

  /**
   * Time taken for the amplitude adjustment to kick in fully (in seconds). This is
   * usually pretty small, not much more than 10 milliseconds (the default value).
   * Also known as the time of the attack phase.
   */
  clampTime(v: UGenInputLike): this {
    this._clampTime = toUGenInput(v);
    return this;
  }

  /**
   * The amount of time for the amplitude adjustment to be released. Usually a bit
   * longer than clamp-time; if both times are too short, you can get some
   * (possibly unwanted) artifacts. Also known as the time of the release phase.
   */
  relaxTime(v: UGenInputLike): this {
    this._relaxTime = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._control);
    inputs.push(this._thresh);
    inputs.push(this._slopeBelow);
    inputs.push(this._slopeAbove);
    inputs.push(this._clampTime);
    inputs.push(this._relaxTime);
    const idx = def.addUgen("Compander", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Limits the input amplitude to the given level. Limiter will not overshoot like
 * Compander will, but it needs to look ahead in the audio. Thus there is a delay
 * equal to twice the lookAheadTime. Limiter, unlike Compander, is completely
 * transparent for an in range signal.
 */
export class Limiter {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _level!: UGenInput;
  private _dur!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Limiter {
    const b = new Limiter();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    b._dur = { tag: 'constant', val: 0.01 };
    return b;
  }

  /** The input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** The peak output amplitude level to which to normalize the input */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /**
   * The buffer delay time. Shorter times will produce smaller delays and quicker
   * transient response times, but may introduce amplitude modulation artifacts.
   * (AKA lookAheadTime)
   */
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
    inputs.push(this._in);
    inputs.push(this._level);
    inputs.push(this._dur);
    const idx = def.addUgen("Limiter", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * flattens dynamics. Normalizes the input amplitude to the given level.
 * Normalize will not overshoot like Compander will, but it needs to look ahead
 * in the audio. Thus there is a delay equal to twice the lookAheadTime.
 */
export class Normalizer {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _level!: UGenInput;
  private _dur!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Normalizer {
    const b = new Normalizer();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    b._dur = { tag: 'constant', val: 0.01 };
    return b;
  }

  /** The input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** The peak output amplitude level to which to normalize the input */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /**
   * The buffer delay time. Shorter times will produce smaller delays and quicker
   * transient response times, but may introduce amplitude modulation artifacts.
   * (AKA lookAheadTime)
   */
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
    inputs.push(this._in);
    inputs.push(this._level);
    inputs.push(this._dur);
    const idx = def.addUgen("Normalizer", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
