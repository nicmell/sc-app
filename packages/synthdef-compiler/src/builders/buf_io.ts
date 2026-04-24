// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Read the contents of a buffer at a specified index
 * 
 * reads the contents of a buffer at a given index.
 */
export class BufRd {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _phase!: UGenInput;
  private _loop!: UGenInput;
  private _interpolation!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufRd {
    const b = new BufRd();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._phase = { tag: 'constant', val: 0 };
    b._loop = { tag: 'constant', val: 1 };
    b._interpolation = { tag: 'constant', val: 2 };
    b._numChannels = 1;
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BufRd {
    const b = new BufRd();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._phase = { tag: 'constant', val: 0 };
    b._loop = { tag: 'constant', val: 1 };
    b._interpolation = { tag: 'constant', val: 2 };
    b._numChannels = 1;
    return b;
  }

  /** The index of the buffer to use */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /**
   * Audio rate modulatable index into the buffer. Warning: The phase argument only
   * offers precision for addressing 2**24 samples (about 6.3 minutes at 44100Hz)
   */
  phase(v: UGenInputLike): this {
    this._phase = toUGenInput(v);
    return this;
  }

  /** 1 means true, 0 means false. This is modulatable. */
  loop(v: UGenInputLike): this {
    this._loop = toUGenInput(v);
    return this;
  }

  /** 1 means no interpolation, 2 is linear, 4 is cubic interpolation */
  interpolation(v: UGenInputLike): this {
    this._interpolation = toUGenInput(v);
    return this;
  }

  /**
   * The number of channels of the supplied buffer. This must be a fixed integer
   * and not a signal or a control proxy. The architecture of the synth design
   * cannot change after it is compiled. (Warning: if you supply a bufnum of a
   * buffer that has a different number of channels than you have specified to
   * buf-rd , it will fail silently).
   */
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
    inputs.push(this._bufnum);
    inputs.push(this._phase);
    inputs.push(this._loop);
    inputs.push(this._interpolation);
    const idx = def.addUgen("BufRd", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * writes to a buffer at a given index. Note, buf-wr (in difference to buf-rd)
 * does not do multichannel expansion, because input is an array.
 */
export class BufWr {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _phase!: UGenInput;
  private _loop!: UGenInput;
  private _inputArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BufWr {
    const b = new BufWr();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._phase = { tag: 'constant', val: 0 };
    b._loop = { tag: 'constant', val: 1 };
    b._inputArray = [];
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BufWr {
    const b = new BufWr();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._phase = { tag: 'constant', val: 0 };
    b._loop = { tag: 'constant', val: 1 };
    b._inputArray = [];
    return b;
  }

  /** the index of the buffer to use */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /** modulatable index into the buffer (has to be audio rate). */
  phase(v: UGenInputLike): this {
    this._phase = toUGenInput(v);
    return this;
  }

  /** 1 means true, 0 means false. This is modulatable */
  loop(v: UGenInputLike): this {
    this._loop = toUGenInput(v);
    return this;
  }

  /** input ugens (channelArray) */
  inputArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._inputArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufnum);
    inputs.push(this._phase);
    inputs.push(this._loop);
    inputs.push(...this._inputArray);
    const idx = def.addUgen("BufWr", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class ClearBuf {
  private _calcRate!: Rate;
  private _buf!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): ClearBuf {
    const b = new ClearBuf();
    b._calcRate = 'scalar';
    b._buf = { tag: 'constant', val: 0 };
    return b;
  }

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
    const idx = def.addUgen("ClearBuf", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class LocalBuf {
  private _calcRate!: Rate;
  private _numFrames!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): LocalBuf {
    const b = new LocalBuf();
    b._calcRate = 'scalar';
    b._numFrames = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  numFrames(v: UGenInputLike): this {
    this._numFrames = toUGenInput(v);
    return this;
  }

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
    inputs.push(this._numFrames);
    const idx = def.addUgen("LocalBuf", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class MaxLocalBufs {
  private _calcRate!: Rate;
  private _numLocalBufs!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): MaxLocalBufs {
    const b = new MaxLocalBufs();
    b._calcRate = 'scalar';
    b._numLocalBufs = { tag: 'constant', val: 0 };
    return b;
  }

  numLocalBufs(v: UGenInputLike): this {
    this._numLocalBufs = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._numLocalBufs);
    const idx = def.addUgen("MaxLocalBufs", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Plays back a sample resident in a buffer */
export class PlayBuf {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _rate!: UGenInput;
  private _trigger!: UGenInput;
  private _startPos!: UGenInput;
  private _loop!: UGenInput;
  private _action!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PlayBuf {
    const b = new PlayBuf();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._rate = { tag: 'constant', val: 1 };
    b._trigger = { tag: 'constant', val: 1 };
    b._startPos = { tag: 'constant', val: 0 };
    b._loop = { tag: 'constant', val: 0 };
    b._action = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): PlayBuf {
    const b = new PlayBuf();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._rate = { tag: 'constant', val: 1 };
    b._trigger = { tag: 'constant', val: 1 };
    b._startPos = { tag: 'constant', val: 0 };
    b._loop = { tag: 'constant', val: 0 };
    b._action = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  /** The index of the buffer to use. */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /**
   * 1.0 is the server's sample rate, 2.0 is one octave up, 0.5 is one octave down
   * -1.0 is backwards normal rate ... etc. Interpolation is cubic. Note: if the
   * buffer's sample rate is different from the server's, you will need to multiply
   * the desired playback rate by (file's rate / server's rate). The UGen
   * (buf-rate-scale bufnum) returns this factor.
   */
  rate(v: UGenInputLike): this {
    this._rate = toUGenInput(v);
    return this;
  }

  /**
   * A trigger causes a jump to the startPos. A trigger occurs when a signal
   * changes from <= 0 to > 0.
   */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /** Sample frame to start playback. */
  startPos(v: UGenInputLike): this {
    this._startPos = toUGenInput(v);
    return this;
  }

  /** 1 means true, 0 means false. This is modulateable. */
  loop(v: UGenInputLike): this {
    this._loop = toUGenInput(v);
    return this;
  }

  /**
   * an integer representing an action to be executed when the buffer is finished
   * playing. This can be used to free the enclosing synth. Action is only
   * evaluated if loop is 0
   */
  action(v: UGenInputLike): this {
    this._action = toUGenInput(v);
    return this;
  }

  /**
   * The number of channels that the buffer will be. This must be a fixed integer.
   * The architechture of the SynthDef cannot change after it is compiled. Warning:
   * if you supply a bufnum of a buffer that has a different numChannels then you
   * have specified to the play-buf, it will fail silently.
   */
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
    inputs.push(this._bufnum);
    inputs.push(this._rate);
    inputs.push(this._trigger);
    inputs.push(this._startPos);
    inputs.push(this._loop);
    inputs.push(this._action);
    const idx = def.addUgen("PlayBuf", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * record a stream of values into a buffer. If recLevel is 1.0 and preLevel is
 * 0.0 then the new input overwrites the old data. If they are both 1.0 then the
 * new data is added to the existing data. (Any other settings are also valid.)
 * Note that the number of channels must be fixed for the defsynth, it cannot
 * vary depending on which buffer you use.
 */
export class RecordBuf {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _offset!: UGenInput;
  private _recLevel!: UGenInput;
  private _preLevel!: UGenInput;
  private _run!: UGenInput;
  private _loop!: UGenInput;
  private _trigger!: UGenInput;
  private _action!: UGenInput;
  private _inputArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): RecordBuf {
    const b = new RecordBuf();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._offset = { tag: 'constant', val: 0 };
    b._recLevel = { tag: 'constant', val: 1 };
    b._preLevel = { tag: 'constant', val: 0 };
    b._run = { tag: 'constant', val: 1 };
    b._loop = { tag: 'constant', val: 1 };
    b._trigger = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    b._inputArray = [];
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): RecordBuf {
    const b = new RecordBuf();
    b._calcRate = 'control';
    b._bufnum = { tag: 'constant', val: 0 };
    b._offset = { tag: 'constant', val: 0 };
    b._recLevel = { tag: 'constant', val: 1 };
    b._preLevel = { tag: 'constant', val: 0 };
    b._run = { tag: 'constant', val: 1 };
    b._loop = { tag: 'constant', val: 1 };
    b._trigger = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    b._inputArray = [];
    return b;
  }

  /** the index of the buffer to use */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /** an offset into the buffer in frames, */
  offset(v: UGenInputLike): this {
    this._offset = toUGenInput(v);
    return this;
  }

  /** value to multiply by input before mixing with existing data. */
  recLevel(v: UGenInputLike): this {
    this._recLevel = toUGenInput(v);
    return this;
  }

  /** value to multiply to existing data in buffer before mixing with input */
  preLevel(v: UGenInputLike): this {
    this._preLevel = toUGenInput(v);
    return this;
  }

  /** If zero, then recording stops, otherwise recording proceeds. */
  run(v: UGenInputLike): this {
    this._run = toUGenInput(v);
    return this;
  }

  /** If zero then don't loop, otherwise do. This is modulate-able. */
  loop(v: UGenInputLike): this {
    this._loop = toUGenInput(v);
    return this;
  }

  /**
   * a trigger causes a jump to the offset position in the Buffer. A trigger occurs
   * when a signal changes from <= 0 to > 0.
   */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /**
   * an integer representing an action to be executed when the buffer is finished
   * playing. This can be used to free the enclosing synth. Action is only
   * evaluated if loop is 0
   */
  action(v: UGenInputLike): this {
    this._action = toUGenInput(v);
    return this;
  }

  /** an Array of input channels */
  inputArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._inputArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufnum);
    inputs.push(this._offset);
    inputs.push(this._recLevel);
    inputs.push(this._preLevel);
    inputs.push(this._run);
    inputs.push(this._loop);
    inputs.push(this._trigger);
    inputs.push(this._action);
    inputs.push(...this._inputArray);
    const idx = def.addUgen("RecordBuf", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class ScopeOut {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _inputArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): ScopeOut {
    const b = new ScopeOut();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._inputArray = [];
    return b;
  }

  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  inputArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._inputArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufnum);
    inputs.push(...this._inputArray);
    const idx = def.addUgen("ScopeOut", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class ScopeOut2 {
  private _calcRate!: Rate;
  private _scopeNum!: UGenInput;
  private _maxFrames!: UGenInput;
  private _scopeFrames!: UGenInput;
  private _inputArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): ScopeOut2 {
    const b = new ScopeOut2();
    b._calcRate = 'audio';
    b._scopeNum = { tag: 'constant', val: 0 };
    b._maxFrames = { tag: 'constant', val: 4096 };
    b._scopeFrames = { tag: 'constant', val: 4096 };
    b._inputArray = [];
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): ScopeOut2 {
    const b = new ScopeOut2();
    b._calcRate = 'control';
    b._scopeNum = { tag: 'constant', val: 0 };
    b._maxFrames = { tag: 'constant', val: 4096 };
    b._scopeFrames = { tag: 'constant', val: 4096 };
    b._inputArray = [];
    return b;
  }

  scopeNum(v: UGenInputLike): this {
    this._scopeNum = toUGenInput(v);
    return this;
  }

  maxFrames(v: UGenInputLike): this {
    this._maxFrames = toUGenInput(v);
    return this;
  }

  scopeFrames(v: UGenInputLike): this {
    this._scopeFrames = toUGenInput(v);
    return this;
  }

  inputArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._inputArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._scopeNum);
    inputs.push(this._maxFrames);
    inputs.push(this._scopeFrames);
    inputs.push(...this._inputArray);
    const idx = def.addUgen("ScopeOut2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class SetBuf {
  private _calcRate!: Rate;
  private _buf!: UGenInput;
  private _values!: UGenInput;
  private _offset!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): SetBuf {
    const b = new SetBuf();
    b._calcRate = 'audio';
    b._buf = { tag: 'constant', val: 0 };
    b._values = { tag: 'constant', val: 0 };
    b._offset = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): SetBuf {
    const b = new SetBuf();
    b._calcRate = 'control';
    b._buf = { tag: 'constant', val: 0 };
    b._values = { tag: 'constant', val: 0 };
    b._offset = { tag: 'constant', val: 0 };
    return b;
  }

  buf(v: UGenInputLike): this {
    this._buf = toUGenInput(v);
    return this;
  }

  values(v: UGenInputLike): this {
    this._values = toUGenInput(v);
    return this;
  }

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
    inputs.push(this._buf);
    inputs.push(this._values);
    inputs.push(this._offset);
    const idx = def.addUgen("SetBuf", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * sample playback from a buffer with fine control for doing granular synthesis.
 * Triggers generate grains from a single channel (mono) buffer. Each grain has a
 * Hann envelope (sin^2(x) for x from 0 to pi) and is panned between two channels
 * of multiple outputs.
 */
export class TGrains {
  private _calcRate!: Rate;
  private _trigger!: UGenInput;
  private _bufnum!: UGenInput;
  private _rate!: UGenInput;
  private _centerPos!: UGenInput;
  private _dur!: UGenInput;
  private _pan!: UGenInput;
  private _amp!: UGenInput;
  private _interp!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): TGrains {
    const b = new TGrains();
    b._calcRate = 'audio';
    b._trigger = { tag: 'constant', val: 0 };
    b._bufnum = { tag: 'constant', val: 0 };
    b._rate = { tag: 'constant', val: 1 };
    b._centerPos = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 0.1 };
    b._pan = { tag: 'constant', val: 0 };
    b._amp = { tag: 'constant', val: 0.1 };
    b._interp = { tag: 'constant', val: 4 };
    b._numChannels = 2;
    return b;
  }

  /**
   * at each trigger, the following arguments are sampled and used as the arguments
   * of a new grain. A trigger occurs when a signal changes from <= 0 to > 0. If
   * the trigger is audio rate then the grains will start with sample accuracy.
   */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /** the index of the buffer to use. It must be a one channel (mono) buffer. */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /**
   * 1.0 is normal, 2.0 is one octave up, 0.5 is one octave down -1.0 is backwards
   * normal rate. Unlike PlayBuf, the rate is multiplied by BufRate, so you needn't
   * do that yourself.
   */
  rate(v: UGenInputLike): this {
    this._rate = toUGenInput(v);
    return this;
  }

  /**
   * the position in the buffer in seconds at which the grain envelope will reach
   * maximum amplitude.
   */
  centerPos(v: UGenInputLike): this {
    this._centerPos = toUGenInput(v);
    return this;
  }

  /** duration of the grain in seconds */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /**
   * a value from -1 to 1. Determines where to pan the output in the same manner as
   * PanAz.
   */
  pan(v: UGenInputLike): this {
    this._pan = toUGenInput(v);
    return this;
  }

  /** amplitude of the grain. */
  amp(v: UGenInputLike): this {
    this._amp = toUGenInput(v);
    return this;
  }

  /**
   * 1,2,or 4. Determines whether the grain uses (1) no interpolation, (2) linear
   * interpolation, or (4) cubic interpolation.
   */
  interp(v: UGenInputLike): this {
    this._interp = toUGenInput(v);
    return this;
  }

  /** number of output channels */
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
    inputs.push(this._trigger);
    inputs.push(this._bufnum);
    inputs.push(this._rate);
    inputs.push(this._centerPos);
    inputs.push(this._dur);
    inputs.push(this._pan);
    inputs.push(this._amp);
    inputs.push(this._interp);
    const idx = def.addUgen("TGrains", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}
