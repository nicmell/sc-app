// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Band Limited Impulse generator. All harmonics have equal amplitude. This is
 * the equivalent of buzz in MusicN languages. WARNING: This waveform in its raw
 * form could be damaging to your ears at high amplitudes or for long periods. It
 * is improved from other implementations in that it will crossfade in a control
 * period when the number of harmonics changes, so that there are no audible
 * pops. It also eliminates the divide in the formula by using a 1/sin table
 * (with special precautions taken for 1/0). The lookup tables are linearly
 * interpolated for better quality. Synth-O-Matic (1990) had an impulse generator
 * called blip, hence that name here rather than 'buzz'.
 */
export class Blip {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _numharm!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Blip {
    const b = new Blip();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._numharm = { tag: 'constant', val: 200 };
    return b;
  }

  /** Frequency in Hertz (control rate) */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * Number of harmonics. This may be lowered internally if it would cause
   * aliasing.
   */
  numharm(v: UGenInputLike): this {
    this._numharm = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._numharm);
    const idx = def.addUgen("Blip", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Very fast sine wave generator (2 PowerPC instructions per output sample!)
 * implemented using a ringing filter. This generates a much cleaner sine wave
 * than a table lookup oscillator and is a lot faster. However, the amplitude of
 * the wave will vary with frequency. Generally the amplitude will go down as you
 * raise the frequency and go up as you lower the frequency. WARNING: In the
 * current implementation, the amplitude can blow up if the frequency is
 * modulated by certain alternating signals.
 */
export class FSinOsc {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _iphase!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): FSinOsc {
    const b = new FSinOsc();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): FSinOsc {
    const b = new FSinOsc();
    b._calcRate = 'control';
    b._freq = { tag: 'constant', val: 440 };
    b._iphase = { tag: 'constant', val: 0 };
    return b;
  }

  /** frequency in Hertz */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** phase offset or modulator in radians */
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
    const idx = def.addUgen("FSinOsc", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Klang is a bank of fixed frequency sine oscillators. Klang is more efficient
 * than creating individual oscillators but offers less flexibility. The specs
 * can't be changed after it has been started. For a modulatable but less
 * efficient version, see dyn-klang.
 */
export class Klang {
  private _calcRate!: Rate;
  private _specs!: UGenInput;
  private _freqscale!: UGenInput;
  private _freqoffset!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Klang {
    const b = new Klang();
    b._calcRate = 'audio';
    b._specs = { tag: 'constant', val: 0 };
    b._freqscale = { tag: 'constant', val: 1 };
    b._freqoffset = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * An array of three arrays frequencies, amplitudes and phases: 1) an array of
   * filter frequencies, 2) an Array of filter amplitudes, or nil. If nil, then
   * amplitudes default to 1.0, 3) an Array of initial phases, or nil. If nil, then
   * phases default to 0.0.
   */
  specs(v: UGenInputLike): this {
    this._specs = toUGenInput(v);
    return this;
  }

  /** a scale factor multiplied by all frequencies at initialization time. */
  freqscale(v: UGenInputLike): this {
    this._freqscale = toUGenInput(v);
    return this;
  }

  /** an offset added to all frequencies at initialization time. */
  freqoffset(v: UGenInputLike): this {
    this._freqoffset = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._specs);
    inputs.push(this._freqscale);
    inputs.push(this._freqoffset);
    const idx = def.addUgen("Klang", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Klank is a bank of fixed frequency resonators which can be used to simulate
 * the resonant modes of an object. Each mode is given a ring time, which is the
 * time for the mode to decay by 60 dB. The specs can't be changed after it has
 * been started. For a modulatable but less efficient version, see dyn-klank.
 */
export class Klank {
  private _calcRate!: Rate;
  private _specs!: UGenInput;
  private _input!: UGenInput;
  private _freqscale!: UGenInput;
  private _freqoffset!: UGenInput;
  private _decayscale!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Klank {
    const b = new Klank();
    b._calcRate = 'audio';
    b._specs = { tag: 'constant', val: 0 };
    b._input = { tag: 'constant', val: 0 };
    b._freqscale = { tag: 'constant', val: 1 };
    b._freqoffset = { tag: 'constant', val: 0 };
    b._decayscale = { tag: 'constant', val: 1 };
    return b;
  }

  /**
   * An array of three arrays: frequencies, amplitudes and ring times: *all arrays
   * should have the same length* 1) an Array of filter frequencies. 2) an Array of
   * filter amplitudes, or nil. If nil, then amplitudes default to 1.0 3) an Array
   * of 60 dB decay times for the filters.
   */
  specs(v: UGenInputLike): this {
    this._specs = toUGenInput(v);
    return this;
  }

  /** the excitation input to the resonant filter bank. */
  input(v: UGenInputLike): this {
    this._input = toUGenInput(v);
    return this;
  }

  /** a scale factor multiplied by all frequencies at initialization time. */
  freqscale(v: UGenInputLike): this {
    this._freqscale = toUGenInput(v);
    return this;
  }

  /** an offset added to all frequencies at initialization time. */
  freqoffset(v: UGenInputLike): this {
    this._freqoffset = toUGenInput(v);
    return this;
  }

  /** a scale factor multiplied by all ring times at initialization time. */
  decayscale(v: UGenInputLike): this {
    this._decayscale = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._specs);
    inputs.push(this._input);
    inputs.push(this._freqscale);
    inputs.push(this._freqoffset);
    inputs.push(this._decayscale);
    const idx = def.addUgen("Klank", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Fixed frequency sine oscillator this ugen uses a very fast algorithm for
 * generating a sine wave at a fixed frequency
 */
export class PSinGrain {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _dur!: UGenInput;
  private _amp!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PSinGrain {
    const b = new PSinGrain();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._dur = { tag: 'constant', val: 0.2 };
    b._amp = { tag: 'constant', val: 1 };
    return b;
  }

  /** frequency in cycles per second. Must be a scalar */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** grain duration */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /** amplitude of grain */
  amp(v: UGenInputLike): this {
    this._amp = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._freq);
    inputs.push(this._dur);
    inputs.push(this._amp);
    const idx = def.addUgen("PSinGrain", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * band limited pulse wave generator with pulse width modulation.
 * 
 * Pulse waves are a general form of square wave that allow for the width of the
 * pulses to be varied. A square wave is therefore a pulse with a width of 0.5
 * i.e. the width of the high and low states is identical. Adjusting the ratio of
 * the pulse width will vary the harmonic content of the sound. For example,
 * reductions in the width allow you to produce thin reed-like timbres along with
 * the wide, hollow sounds created by a square wave.
 */
export class Pulse {
  private _calcRate!: Rate;
  private _freq!: UGenInput;
  private _width!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Pulse {
    const b = new Pulse();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    b._width = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** Frequency in Hertz (control rate) */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** Pulse width ratio from zero to one. 0.5 makes a square wave (control rate) */
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
    inputs.push(this._width);
    const idx = def.addUgen("Pulse", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * band limited sawtooth wave generator
 * 
 * The sawtooth wave produces even and odd harmonics in series and therefore
 * produces a bright sound that is an excellent starting point for brassy, raspy
 * sounds. It's also suitable for creating the gritty, bright sounds needed for
 * leads and raspy basses. Due to its harmonic richness it's extremely suitable
 * for use with sounds that will be filter swept.
 */
export class Saw {
  private _calcRate!: Rate;
  private _freq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Saw {
    const b = new Saw();
    b._calcRate = 'audio';
    b._freq = { tag: 'constant', val: 440 };
    return b;
  }

  /** Frequency in Hertz (control rate). */
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
    const idx = def.addUgen("Saw", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
