// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/** current number of channels of soundfile in buffer */
export class BufChannels {
  private _calcRate!: Rate;
  private _buf!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): BufChannels {
    const b = new BufChannels();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): BufChannels {
    const b = new BufChannels();
    b._calcRate = 'scalar';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** a buffer */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    const idx = def.addUgen("BufChannels", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the current duration of a buffer in seconds. */
export class BufDur {
  private _calcRate!: Rate;
  private _buf!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): BufDur {
    const b = new BufDur();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): BufDur {
    const b = new BufDur();
    b._calcRate = 'scalar';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** a buffer */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    const idx = def.addUgen("BufDur", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * returns the current number of allocated frames i.e. the size of the buffer.
 * This is the equivalent of Clojure's count on a seq.
 */
export class BufFrames {
  private _calcRate!: Rate;
  private _buf!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): BufFrames {
    const b = new BufFrames();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): BufFrames {
    const b = new BufFrames();
    b._calcRate = 'scalar';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** a buffer */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    const idx = def.addUgen("BufFrames", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns a ratio by which the playback of a buffer is to be scaled */
export class BufRateScale {
  private _calcRate!: Rate;
  private _buf!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): BufRateScale {
    const b = new BufRateScale();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): BufRateScale {
    const b = new BufRateScale();
    b._calcRate = 'scalar';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** a buffer */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    const idx = def.addUgen("BufRateScale", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the buffers current sample rate */
export class BufSampleRate {
  private _calcRate!: Rate;
  private _buf!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): BufSampleRate {
    const b = new BufSampleRate();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): BufSampleRate {
    const b = new BufSampleRate();
    b._calcRate = 'scalar';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** a buffer */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    const idx = def.addUgen("BufSampleRate", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** current number of samples allocated in the buffer */
export class BufSamples {
  private _calcRate!: Rate;
  private _buf!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): BufSamples {
    const b = new BufSamples();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): BufSamples {
    const b = new BufSamples();
    b._calcRate = 'scalar';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

  /** a buffer */
  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buf);
    const idx = def.addUgen("BufSamples", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * test for infinity, not-a-number, and denormals. If one of these is found, it
 * posts a warning. Its output is as follows: 0 = a normal float, 1 = NaN, 2 =
 * infinity, and 3 = a denormal.
 */
export class CheckBadValues {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _id!: UGenInput;
  private _post!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): CheckBadValues {
    const b = new CheckBadValues();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._id = { tag: 'constant', val: 0 };
    b._post = { tag: 'constant', val: 2 };
    return b;
  }

  /** Build at ir rate (Rate::Scalar). */
  static ir(): CheckBadValues {
    const b = new CheckBadValues();
    b._calcRate = 'scalar';
    b._in = { tag: 'constant', val: 0 };
    b._id = { tag: 'constant', val: 0 };
    b._post = { tag: 'constant', val: 2 };
    return b;
  }

  /** the UGen whose output is to be tested */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** an id number to identify this UGen. */
  id(v: UGenInputLike): this {
    this._id = toUGenInput(v);
    return this;
  }

  /**
   * One of three post modes: 0 = no posting; 1 = post a line for every bad value;
   * 2 = post a line only when the floating-point classification changes (e.g.,
   * normal -> NaN and vice versa)
   */
  post(v: UGenInputLike): this {
    this._post = toUGenInput(v);
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
    inputs.push(this._post);
    const idx = def.addUgen("CheckBadValues", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the current control rate block duration of the server in seconds */
export class ControlDur {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): ControlDur {
    const b = new ControlDur();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("ControlDur", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the current control rate of the server */
export class ControlRate {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): ControlRate {
    const b = new ControlRate();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("ControlRate", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the number of audio buses allocated on the server. */
export class NumAudioBuses {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): NumAudioBuses {
    const b = new NumAudioBuses();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("NumAudioBuses", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the number of buffers allocated on the server */
export class NumBuffers {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): NumBuffers {
    const b = new NumBuffers();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("NumBuffers", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the number of control buses allocated on the server */
export class NumControlBuses {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): NumControlBuses {
    const b = new NumControlBuses();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("NumControlBuses", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * returns the number of input buses allocated on the server. This is the number
 * of hardware inputs provided by the host machine such as a mic.
 */
export class NumInputBuses {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): NumInputBuses {
    const b = new NumInputBuses();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("NumInputBuses", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * returns the number of output buses allocated on the server. This is the number
 * of hardware outputs provided by the host machine such as left and right
 * speakers.
 */
export class NumOutputBuses {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): NumOutputBuses {
    const b = new NumOutputBuses();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("NumOutputBuses", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the number of currently running synths */
export class NumRunningSynths {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): NumRunningSynths {
    const b = new NumRunningSynths();
    b._calcRate = 'scalar';
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): NumRunningSynths {
    const b = new NumRunningSynths();
    b._calcRate = 'control';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("NumRunningSynths", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * poll cgen instead.
 */
export class Poll {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _in!: UGenInput;
  private _label!: UGenInput;
  private _trigId!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Poll {
    const b = new Poll();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._label = { tag: 'constant', val: 0 };
    b._trigId = { tag: 'constant', val: -1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Poll {
    const b = new Poll();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._label = { tag: 'constant', val: 0 };
    b._trigId = { tag: 'constant', val: -1 };
    return b;
  }

  /** a non-positive to positive transition telling Poll to return a value */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** the signal you want to poll */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** a string or symbol to be printed with the polled value */
  label(v: UGenInputLike): this {
    this._label = toUGenInput(v);
    return this;
  }

  /**
   * if greater than 0, a '/tr' message is sent back to the client (similar to
   * send-trig)
   */
  trigId(v: UGenInputLike): this {
    this._trigId = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._in);
    inputs.push(this._label);
    inputs.push(this._trigId);
    const idx = def.addUgen("Poll", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class RadiansPerSample {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): RadiansPerSample {
    const b = new RadiansPerSample();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("RadiansPerSample", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the current sample duration of the server in seconds */
export class SampleDur {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): SampleDur {
    const b = new SampleDur();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("SampleDur", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** returns the current sample rate */
export class SampleRate {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): SampleRate {
    const b = new SampleRate();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("SampleRate", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** offset from synth start within one sample */
export class SubsampleOffset {
  private _calcRate!: Rate;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): SubsampleOffset {
    const b = new SubsampleOffset();
    b._calcRate = 'scalar';
    return b;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    const idx = def.addUgen("SubsampleOffset", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
