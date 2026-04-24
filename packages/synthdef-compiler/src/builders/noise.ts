// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Noise whose spectrum falls off in power by 6 dB per octave.
 * 
 * Useful for generating percussive sounds such as snares and hand claps. Also
 * useful for simulating wind or sea effects, for producing breath effects in
 * wind instrument timbres or for producing the typical trance leads.
 */
export class BrownNoise {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BrownNoise {
    const b = new BrownNoise();
    b._calcRate = 'audio';
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BrownNoise {
    const b = new BrownNoise();
    b._calcRate = 'control';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("BrownNoise", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Noise whose values are either -1 or 1.
 * 
 * This produces the maximum energy for the least peak to peak amplitude. Useful
 * for generating percussive sounds such as snares and hand claps. Also useful
 * for simulating wind or sea effects, for producing breath effects in wind
 * instrument timbres or for producing the typical trance leads.
 */
export class ClipNoise {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): ClipNoise {
    const b = new ClipNoise();
    b._calcRate = 'audio';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("ClipNoise", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Chaotic noise generator
 * 
 * A noise generator based on a chaotic function. Useful for generating
 * percussive sounds such as snares and hand claps. Also useful for simulating
 * wind or sea effects, for producing breath effects in wind instrument timbres
 * or for producing the typical trance leads.
 */
export class Crackle {
  private _calcRate!: Rate;
  private _chaosParam!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Crackle {
    const b = new Crackle();
    b._calcRate = 'audio';
    b._chaosParam = { tag: 'constant', val: 1.5 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Crackle {
    const b = new Crackle();
    b._calcRate = 'control';
    b._chaosParam = { tag: 'constant', val: 1.5 };
    return b;
  }

  /**
   * a parameter of the chaotic function with useful values from just below 1.0 to
   * just above 2.0. Towards 2.0 the sound crackles.
   */
  chaosParam(v: UGenInputLike): this {
    this._chaosParam = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chaosParam);
    const idx = def.addUgen("Crackle", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Generates random impulses from 0 to +1. */
export class Dust {
  private _calcRate!: Rate;
  private _density!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Dust {
    const b = new Dust();
    b._calcRate = 'audio';
    b._density = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Dust {
    const b = new Dust();
    b._calcRate = 'control';
    b._density = { tag: 'constant', val: 0 };
    return b;
  }

  /** average number of impulses per second */
  density(v: UGenInputLike): this {
    this._density = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._density);
    const idx = def.addUgen("Dust", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Generates random impulses from -1 to +1. */
export class Dust2 {
  private _calcRate!: Rate;
  private _density!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Dust2 {
    const b = new Dust2();
    b._calcRate = 'audio';
    b._density = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Dust2 {
    const b = new Dust2();
    b._calcRate = 'control';
    b._density = { tag: 'constant', val: 0 };
    return b;
  }

  /** average number of impulses per second. */
  density(v: UGenInputLike): this {
    this._density = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._density);
    const idx = def.addUgen("Dust2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Random impulses from -1 to +1 given a density
 * 
 * Creates a sequence of random impulses from -1 to +1. Generates noise which
 * results from flipping random bits in a word. This type of noise has a high RMS
 * level relative to its peak to peak level. The spectrum is emphasized towards
 * lower frequencies. Useful for generating percussive sounds such as snares and
 * hand claps. Also useful for simulating wind or sea effects, for producing
 * breath effects in wind instrument timbres or for producing the typical trance
 * leads.
 */
export class GrayNoise {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): GrayNoise {
    const b = new GrayNoise();
    b._calcRate = 'audio';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("GrayNoise", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Returns a unique output value from zero to one for each input value according
 * to a hash function. The same input value will always produce the same output
 * value. The input need not be from zero to one.
 */
export class Hasher {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Hasher {
    const b = new Hasher();
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
    const idx = def.addUgen("Hasher", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Randomly generates the values -1 or +1 at a rate given by the nearest integer
 * division of the sample rate by the freq argument. It is probably pretty hard
 * on your speakers!
 */
export class LFClipNoise {
  private _calcRate!: Rate;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFClipNoise {
    const b = new LFClipNoise();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFClipNoise {
    const b = new LFClipNoise();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** approximate rate at which to generate random values. */
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
    inputs.push(this._freq);
    const idx = def.addUgen("LFClipNoise", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Like lf-clip-noise, it generates the values -1 or +1 at a rate given by the
 * freq argument, with two differences: * no time quantization * fast recovery
 * from low freq values. (lf-clip-noise, as well as lf-noise0,1,2 quantize to the
 * nearest integer division of the samplerate, and they poll the freq argument
 * only when scheduled; thus they often seem to hang when freqs get very low). If
 * you don't need very high or very low freqs, or use fixed freqs lf-noise0 is
 * more efficient.
 */
export class LFDClipNoise {
  private _calcRate!: Rate;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFDClipNoise {
    const b = new LFDClipNoise();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFDClipNoise {
    const b = new LFDClipNoise();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** rate at which to generate random values. */
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
    inputs.push(this._freq);
    const idx = def.addUgen("LFDClipNoise", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Like lf-noise0, it generates random values between -1 and 1 at a rate given by
 * the freq argument, with two differences: p * no time quantization * fast
 * recovery from low freq values. (lf-noise0,1,2 quantize to the nearest integer
 * division of the samplerate and they poll the freq argument only when
 * scheduled, and thus seem to hang when freqs get very low). If you don't need
 * very high or very low freqs, or use fixed freqs lf-noise0 is more efficient.
 */
export class LFDNoise0 {
  private _calcRate!: Rate;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFDNoise0 {
    const b = new LFDNoise0();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFDNoise0 {
    const b = new LFDNoise0();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** rate at which to generate random values. */
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
    inputs.push(this._freq);
    const idx = def.addUgen("LFDNoise0", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Like lf-noise1, it generates linearly interpolated random values between -1
 * and 1 at a rate given by the freq argument, with two differences: * no time
 * quantization * fast recovery from low freq values. (lf-noise0,1,2 quantize to
 * the nearest integer division of the samplerate and they poll the freq argument
 * only when scheduled, and thus seem to hang when freqs get very low). If you
 * don't need very high or very low freqs, or use fixed freqs lf-noise1 is more
 * efficient.
 */
export class LFDNoise1 {
  private _calcRate!: Rate;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFDNoise1 {
    const b = new LFDNoise1();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFDNoise1 {
    const b = new LFDNoise1();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** rate at which to generate random values. */
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
    inputs.push(this._freq);
    const idx = def.addUgen("LFDNoise1", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Similar to lf-noise2, it generates polynomially interpolated random values
 * between -1 and 1 at a rate given by the freq argument, with 3 differences: *
 * no time quantization * fast recovery from low freq values * cubic instead of
 * quadratic interpolation (lf-noise0,1,2 quantize to the nearest integer
 * division of the samplerate and they poll the freq argument only when
 * scheduled, and thus seem to hang when freqs get very low). If you don't need
 * very high or very low freqs, or use fixed freqs lf-noise2 is more efficient.
 */
export class LFDNoise3 {
  private _calcRate!: Rate;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFDNoise3 {
    const b = new LFDNoise3();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFDNoise3 {
    const b = new LFDNoise3();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** rate at which to generate random values. */
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
    inputs.push(this._freq);
    const idx = def.addUgen("LFDNoise3", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates random values between -1 and 1 at a rate (the rate is not guaranteed
 * but approximate)
 */
export class LFNoise0 {
  private _calcRate!: Rate;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFNoise0 {
    const b = new LFNoise0();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFNoise0 {
    const b = new LFNoise0();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** approximate rate at which to generate random values. */
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
    inputs.push(this._freq);
    const idx = def.addUgen("LFNoise0", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates linearly interpolated random values between -1 and 1 at the supplied
 * rate (the rate is not guaranteed but approximate).
 */
export class LFNoise1 {
  private _calcRate!: Rate;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFNoise1 {
    const b = new LFNoise1();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFNoise1 {
    const b = new LFNoise1();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** approximate rate at which to generate random values. */
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
    inputs.push(this._freq);
    const idx = def.addUgen("LFNoise1", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Generates quadratically interpolated random values between -1 and 1 at the
 * supplied rate (the rate is not guaranteed but approximate). Note: quadratic
 * interpolation means that the noise values can occasionally extend beyond the
 * normal range of +-1, if the freq varies in certain ways. If this is
 * undesirable then you might like to clip2 the values or use a
 * linearly-interpolating unit instead.
 */
export class LFNoise2 {
  private _calcRate!: Rate;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LFNoise2 {
    const b = new LFNoise2();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LFNoise2 {
    const b = new LFNoise2();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 500 };
    return b;
  }

  /** approximate rate at which to generate random values. */
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
    inputs.push(this._freq);
    const idx = def.addUgen("LFNoise2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A noise generator based on the logistic map: y = chaos-param * y * (1.0 - y) y
 * will stay in the range of 0.0 to 1.0 for normal values of the chaos-param.
 * This leads to a DC offset and may cause a pop when you stop the Synth. For
 * output you might want to combine this UGen with a LeakDC or rescale around 0.0
 * via mul and add: see example below.
 */
export class Logistic {
  private _calcRate!: Rate;
  private _chaosParam!: UGenInput;
  private _freq!: UGenInput;
  private _init!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Logistic {
    const b = new Logistic();
    b._calcRate = 'audio';
    b._chaosParam = { tag: 'constant', val: 3 };
    b._freq = { tag: 'constant', val: 1000 };
    b._init = { tag: 'constant', val: 0.5 };
    return b;
  }

  /**
   * a parameter of the chaotic function with useful values from 0.0 to 4.0. Chaos
   * occurs from 3.57 up. Don't use values outside this range if you don't want the
   * UGen to blow up.
   */
  chaosParam(v: UGenInputLike): this {
    this._chaosParam = toUGenInput(v);
    return this;
  }

  /**
   * Frequency of calculation; if over the sampling rate, this is clamped to the
   * sampling rate
   */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Initial value of y (see equation below) */
  init(v: UGenInputLike): this {
    this._init = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chaosParam);
    inputs.push(this._freq);
    inputs.push(this._init);
    const idx = def.addUgen("Logistic", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Masks off bits in the mantissa of the floating point sample value. This
 * introduces a quantization noise, but is less severe than linearly quantizing
 * the signal.
 */
export class MantissaMask {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _bits!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): MantissaMask {
    const b = new MantissaMask();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._bits = { tag: 'constant', val: 3 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** the number of mantissa bits to preserve. a number from 0 to 23. */
  bits(v: UGenInputLike): this {
    this._bits = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._bits);
    const idx = def.addUgen("MantissaMask", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Noise whose spectrum falls off in power by 3 dB per octave.
 * 
 * Noise that gives equal power over the span of each octave. Useful for
 * generating percussive sounds such as snares and hand claps. Also useful for
 * simulating wind or sea effects, for producing breath effects in wind
 * instrument timbres or for producing the typical trance leads. This version
 * gives 8 octaves of pink noise.
 */
export class PinkNoise {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PinkNoise {
    const b = new PinkNoise();
    b._calcRate = 'audio';
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): PinkNoise {
    const b = new PinkNoise();
    b._calcRate = 'control';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("PinkNoise", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Noise whose spectrum has equal power at all frequencies.
 * 
 * Noise that contains equal amounts of energy at every frequency - comparable to
 * radio static. Useful for generating percussive sounds such as snares and hand
 * claps. Also useful for simulating wind or sea effects, for producing breath
 * effects in wind instrument timbres or for producing the typical trance leads.
 */
export class WhiteNoise {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): WhiteNoise {
    const b = new WhiteNoise();
    b._calcRate = 'audio';
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): WhiteNoise {
    const b = new WhiteNoise();
    b._calcRate = 'control';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("WhiteNoise", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
