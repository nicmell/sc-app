// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * fast fourier transform, converts input data from the time to the frequency
 * domain and stores the result in a buffer (audio waveform -> graph equalizer
 * bands) Output is -1 except when an FFT frame is ready, when the output is the
 * buffer index. This creates a special kind of slower pseudo-rate (built on top
 * of control rate) which all the pv-ugens understand.
 */
export class FFT {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _in!: UGenInput;
  private _hop!: UGenInput;
  private _wintype!: UGenInput;
  private _active!: UGenInput;
  private _winsize!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): FFT {
    const b = new FFT();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._in = { tag: 'constant', val: 0 };
    b._hop = { tag: 'constant', val: 0.5 };
    b._wintype = { tag: 'constant', val: 0 };
    b._active = { tag: 'constant', val: 1 };
    b._winsize = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * The buffer where a frame will be held. Its size must be a power of two.
   * local-buf is useful here, because processes should not share data between
   * synths. (Note: most PV UGens operate on this data in place. Use buffer-2n if
   * you wish to create an external buffer.
   */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /**
   * the signal to be analyzed. The signal's rate determines the rate at which the
   * input is read.
   */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * the amount of offset from one FFT analysis frame to the next, measured in
   * multiples of the analysis frame size. This can range between zero and one, and
   * the default is 0.5 (meaning each frame has a 50% overlap with the
   * preceding/following frames).
   */
  hop(v: UGenInputLike): this {
    this._hop = toUGenInput(v);
    return this;
  }

  /**
   * defines how the data is windowed: RECT is for rectangular windowing, simple
   * but typically not recommended; SINE (the default) is for Sine windowing,
   * typically recommended for phase-vocoder work; HANN is for Hann windowing,
   * typically recommended for analysis work.
   */
  wintype(v: UGenInputLike): this {
    this._wintype = toUGenInput(v);
    return this;
  }

  /**
   * is a simple control allowing FFT analysis to be active (>0) or inactive (<=0).
   * This is mainly useful for signal analysis processes which are only intended to
   * analyse at specific times rather than continuously
   */
  active(v: UGenInputLike): this {
    this._active = toUGenInput(v);
    return this;
  }

  /**
   * the windowed audio frames are usually the same size as the buffer. If you wish
   * the FFT to be zero-padded then you can specify a window size smaller than the
   * actual buffer size (e.g. window size 1024 with buffer size 2048). Both values
   * must still be a power of two. Leave this at its default of zero for no
   * zero-padding.
   */
  winsize(v: UGenInputLike): this {
    this._winsize = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._in);
    inputs.push(this._hop);
    inputs.push(this._wintype);
    inputs.push(this._active);
    inputs.push(this._winsize);
    const idx = def.addUgen("FFT", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Outputs the necessary signal for FFT chains, without doing an FFT on a signal */
export class FFTTrigger {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _hop!: UGenInput;
  private _polar!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): FFTTrigger {
    const b = new FFTTrigger();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._hop = { tag: 'constant', val: 0.5 };
    b._polar = { tag: 'constant', val: 0 };
    return b;
  }

  /** a buffer to condition for FFT use */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** the hop size for timing triggers */
  hop(v: UGenInputLike): this {
    this._hop = toUGenInput(v);
    return this;
  }

  /**
   * a flag. If 0.0, the buffer will be prepared for complex data, if > 0.0, polar
   * data is set up.
   */
  polar(v: UGenInputLike): this {
    this._polar = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._hop);
    inputs.push(this._polar);
    const idx = def.addUgen("FFTTrigger", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * inverse fast fourier transform, converts buffer data from frequency domain to
 * time domain The IFFT UGen converts the FFT data in-place (in the original FFT
 * buffer) and overlap-adds the result to produce a continuous signal at its
 * output.
 */
export class IFFT {
  private _calcRate!: Rate;
  private _chain!: UGenInput;
  private _wintype!: UGenInput;
  private _winsize!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): IFFT {
    const b = new IFFT();
    b._calcRate = 'audio';
    b._chain = { tag: 'constant', val: 0 };
    b._wintype = { tag: 'constant', val: 0 };
    b._winsize = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): IFFT {
    const b = new IFFT();
    b._calcRate = 'control';
    b._chain = { tag: 'constant', val: 0 };
    b._wintype = { tag: 'constant', val: 0 };
    b._winsize = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * The FFT chain signal coming originally from an FFT UGen, perhaps via other PV
   * UGens.
   */
  chain(v: UGenInputLike): this {
    this._chain = toUGenInput(v);
    return this;
  }

  /**
   * defines how the data is windowed: RECT is for rectangular windowing, simple
   * but typically not recommended; SINE (the default) is for Sine windowing,
   * typically recommended for phase-vocoder work; HANN is for Hann windowing,
   * typically recommended for analysis work.
   */
  wintype(v: UGenInputLike): this {
    this._wintype = toUGenInput(v);
    return this;
  }

  /** can be used to account for zero-padding, in the same way as the FFT UGen. */
  winsize(v: UGenInputLike): this {
    this._winsize = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._chain);
    inputs.push(this._wintype);
    inputs.push(this._winsize);
    const idx = def.addUgen("IFFT", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** complex addition: RealA + RealB, ImagA + ImagB */
export class PV_Add {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_Add {
    const b = new PV_Add();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer A */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    const idx = def.addUgen("PV_Add", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * randomizes the order of the bins. The trigger will select a new random
 * ordering.
 */
export class PV_BinScramble {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _wipe!: UGenInput;
  private _width!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_BinScramble {
    const b = new PV_BinScramble();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._wipe = { tag: 'constant', val: 0 };
    b._width = { tag: 'constant', val: 0.2 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** scrambles more bins as wipe moves from zero to one. */
  wipe(v: UGenInputLike): this {
    this._wipe = toUGenInput(v);
    return this;
  }

  /**
   * a value from zero to one, indicating the maximum randomized distance of a bin
   * from its original location in the spectrum.
   */
  width(v: UGenInputLike): this {
    this._width = toUGenInput(v);
    return this;
  }

  /** a trigger selects a new random ordering. */
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
    inputs.push(this._buffer);
    inputs.push(this._wipe);
    inputs.push(this._width);
    inputs.push(this._trig);
    const idx = def.addUgen("PV_BinScramble", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * shift and scale the positions of the bins. Can be used as a very crude
 * frequency shifter/scaler.
 */
export class PV_BinShift {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _stretch!: UGenInput;
  private _shift!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_BinShift {
    const b = new PV_BinShift();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._stretch = { tag: 'constant', val: 1 };
    b._shift = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer. */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** scale bin location by factor. */
  stretch(v: UGenInputLike): this {
    this._stretch = toUGenInput(v);
    return this;
  }

  /** add an offset to bin position. */
  shift(v: UGenInputLike): this {
    this._shift = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._stretch);
    inputs.push(this._shift);
    const idx = def.addUgen("PV_BinShift", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** copies low bins from one input and the high bins of the other */
export class PV_BinWipe {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;
  private _wipe!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_BinWipe {
    const b = new PV_BinWipe();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    b._wipe = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer A */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /**
   * can range between -1 and +1; if wipe == 0 then the output is the same as inA;
   * if wipe > 0 then it begins replacing with bins from inB from the bottom up;if
   * wipe < 0 then it begins replacing with bins from inB from the top down.
   */
  wipe(v: UGenInputLike): this {
    this._wipe = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    inputs.push(this._wipe);
    const idx = def.addUgen("PV_BinWipe", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** clears bins above or below a cutoff point */
export class PV_BrickWall {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _wipe!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_BrickWall {
    const b = new PV_BrickWall();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._wipe = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /**
   * can range between -1 and +1. if wipe == 0 then there is no effect; if wipe > 0
   * then it acts like a high pass filter, clearing bins from the bottom up; if
   * wipe < 0 then it acts like a low pass filter, clearing bins from the top down.
   */
  wipe(v: UGenInputLike): this {
    this._wipe = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._wipe);
    const idx = def.addUgen("PV_BrickWall", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * converts the FFT frames to their complex conjugate (i.e. reverses the sign of
 * their imaginary part). This is not usually a useful audio effect in itself,
 * but may be a component of other analysis or transformation processes...
 */
export class PV_Conj {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_Conj {
    const b = new PV_Conj();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    const idx = def.addUgen("PV_Conj", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * copies the spectral frame in bufferA to bufferB at that point in the chain of
 * PV UGens. This allows for parallel processing of spectral data without the
 * need for multiple FFT UGens, and to copy out data at that point in the chain
 * for other purposes. bufferA and bufferB must be the same size.
 */
export class PV_Copy {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_Copy {
    const b = new PV_Copy();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    return b;
  }

  /** source buffer */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** destination buffer */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    const idx = def.addUgen("PV_Copy", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** combines magnitudes of first input and phases of the second input */
export class PV_CopyPhase {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_CopyPhase {
    const b = new PV_CopyPhase();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer A */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    const idx = def.addUgen("PV_CopyPhase", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * adds a different constant random phase shift to each bin. The trigger will
 * select a new set of random phases.
 */
export class PV_Diffuser {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_Diffuser {
    const b = new PV_Diffuser();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** a trigger selects a new set of random values. */
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
    inputs.push(this._buffer);
    inputs.push(this._trig);
    const idx = def.addUgen("PV_Diffuser", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** complex division */
export class PV_Div {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_Div {
    const b = new PV_Div();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer A */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    const idx = def.addUgen("PV_Div", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * passes only bins whose magnitude is above a threshold and above their nearest
 * neighbors
 */
export class PV_LocalMax {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _threshold!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_LocalMax {
    const b = new PV_LocalMax();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._threshold = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** magnitude threshold. */
  threshold(v: UGenInputLike): this {
    this._threshold = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._threshold);
    const idx = def.addUgen("PV_LocalMax", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** passes only bins whose magnitude is above a threshold */
export class PV_MagAbove {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _threshold!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagAbove {
    const b = new PV_MagAbove();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._threshold = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** magnitude threshold. */
  threshold(v: UGenInputLike): this {
    this._threshold = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._threshold);
    const idx = def.addUgen("PV_MagAbove", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** passes only bins whose magnitude is below a threshold */
export class PV_MagBelow {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _threshold!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagBelow {
    const b = new PV_MagBelow();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._threshold = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** magnitude threshold. */
  threshold(v: UGenInputLike): this {
    this._threshold = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._threshold);
    const idx = def.addUgen("PV_MagBelow", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** clips bin magnitudes to a maximum threshold */
export class PV_MagClip {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _threshold!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagClip {
    const b = new PV_MagClip();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._threshold = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** magnitude threshold. */
  threshold(v: UGenInputLike): this {
    this._threshold = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._threshold);
    const idx = def.addUgen("PV_MagClip", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** divides magnitudes of two inputs and keeps the phases of the first input */
export class PV_MagDiv {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;
  private _zeroed!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagDiv {
    const b = new PV_MagDiv();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    b._zeroed = { tag: 'constant', val: 0.0001 };
    return b;
  }

  /** fft buffer A. */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B. */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /** number to use when bins are zeroed out, i.e. causing division by zero */
  zeroed(v: UGenInputLike): this {
    this._zeroed = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    inputs.push(this._zeroed);
    const idx = def.addUgen("PV_MagDiv", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** freezes magnitudes at current levels when freeze > 0 */
export class PV_MagFreeze {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _freeze!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagFreeze {
    const b = new PV_MagFreeze();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._freeze = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** if freeze > 0 then magnitudes are frozen at current levels. */
  freeze(v: UGenInputLike): this {
    this._freeze = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._freeze);
    const idx = def.addUgen("PV_MagFreeze", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** multiplies magnitudes of two inputs and keeps the phases of the first input */
export class PV_MagMul {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagMul {
    const b = new PV_MagMul();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer A */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    const idx = def.addUgen("PV_MagMul", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** magnitudes are multiplied with noise */
export class PV_MagNoise {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagNoise {
    const b = new PV_MagNoise();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    const idx = def.addUgen("PV_MagNoise", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * shift and stretch the positions of only the magnitude of the bins. Can be used
 * as a very crude frequency shifter/scaler.
 */
export class PV_MagShift {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _stretch!: UGenInput;
  private _shift!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagShift {
    const b = new PV_MagShift();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._stretch = { tag: 'constant', val: 1 };
    b._shift = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer. */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** scale bin location by factor. */
  stretch(v: UGenInputLike): this {
    this._stretch = toUGenInput(v);
    return this;
  }

  /** add an offset to bin position. */
  shift(v: UGenInputLike): this {
    this._shift = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._stretch);
    inputs.push(this._shift);
    const idx = def.addUgen("PV_MagShift", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** average a bin's magnitude with its neighbors */
export class PV_MagSmear {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _bins!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagSmear {
    const b = new PV_MagSmear();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._bins = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /**
   * number of bins to average on each side of bin. As this number rises, so will
   * CPU usage.
   */
  bins(v: UGenInputLike): this {
    this._bins = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._bins);
    const idx = def.addUgen("PV_MagSmear", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * squares the magnitudes and renormalizes to previous peak. This makes weak bins
 * weaker.
 */
export class PV_MagSquared {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_MagSquared {
    const b = new PV_MagSquared();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    const idx = def.addUgen("PV_MagSquared", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** output copies bins with the maximum magnitude of the two inputs */
export class PV_Max {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_Max {
    const b = new PV_Max();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer A */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    const idx = def.addUgen("PV_Max", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** output copies bins with the minimum magnitude of the two inputs */
export class PV_Min {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_Min {
    const b = new PV_Min();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer A */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    const idx = def.addUgen("PV_Min", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * complex multiplication: (RealA * RealB) - (ImagA * ImagB) (ImagA * RealB) +
 * (RealA * ImagB)
 */
export class PV_Mul {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_Mul {
    const b = new PV_Mul();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer A */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    const idx = def.addUgen("PV_Mul", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** shift phase of all bins */
export class PV_PhaseShift {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _shift!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_PhaseShift {
    const b = new PV_PhaseShift();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._shift = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** phase shift in radians */
  shift(v: UGenInputLike): this {
    this._shift = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    inputs.push(this._shift);
    const idx = def.addUgen("PV_PhaseShift", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** shift phase of all bins by 270 degrees */
export class PV_PhaseShift270 {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_PhaseShift270 {
    const b = new PV_PhaseShift270();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    const idx = def.addUgen("PV_PhaseShift270", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** shift phase of all bins by 90 degrees */
export class PV_PhaseShift90 {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_PhaseShift90 {
    const b = new PV_PhaseShift90();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._buffer);
    const idx = def.addUgen("PV_PhaseShift90", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** randomly clear bins */
export class PV_RandComb {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _wipe!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_RandComb {
    const b = new PV_RandComb();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._wipe = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer. */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** clears bins from input in a random order as wipe goes from 0 to 1. */
  wipe(v: UGenInputLike): this {
    this._wipe = toUGenInput(v);
    return this;
  }

  /** a trigger selects a new random ordering. */
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
    inputs.push(this._buffer);
    inputs.push(this._wipe);
    inputs.push(this._trig);
    const idx = def.addUgen("PV_RandComb", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** cross fades between two sounds by copying bins in a random order */
export class PV_RandWipe {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;
  private _wipe!: UGenInput;
  private _trig!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_RandWipe {
    const b = new PV_RandWipe();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    b._wipe = { tag: 'constant', val: 0 };
    b._trig = { tag: 'constant', val: 0 };
    return b;
  }

  /** fft buffer A. */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B. */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /** copies bins from bufferB in a random order as wipe goes from 0 to 1. */
  wipe(v: UGenInputLike): this {
    this._wipe = toUGenInput(v);
    return this;
  }

  /** a trigger selects a new random ordering. */
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
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    inputs.push(this._wipe);
    inputs.push(this._trig);
    const idx = def.addUgen("PV_RandWipe", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** makes a series of gaps in a spectrum */
export class PV_RectComb {
  private _calcRate!: Rate;
  private _buffer!: UGenInput;
  private _numTeeth!: UGenInput;
  private _phase!: UGenInput;
  private _width!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_RectComb {
    const b = new PV_RectComb();
    b._calcRate = 'control';
    b._buffer = { tag: 'constant', val: 0 };
    b._numTeeth = { tag: 'constant', val: 0 };
    b._phase = { tag: 'constant', val: 0 };
    b._width = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** fft buffer. */
  buffer(v: UGenInputLike): this {
    this._buffer = toUGenInput(v);
    return this;
  }

  /** number of teeth in the comb. */
  numTeeth(v: UGenInputLike): this {
    this._numTeeth = toUGenInput(v);
    return this;
  }

  /** starting phase of comb pulse. */
  phase(v: UGenInputLike): this {
    this._phase = toUGenInput(v);
    return this;
  }

  /** pulse width of comb. */
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
    inputs.push(this._buffer);
    inputs.push(this._numTeeth);
    inputs.push(this._phase);
    inputs.push(this._width);
    const idx = def.addUgen("PV_RectComb", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** alternates blocks of bins between the two inputs */
export class PV_RectComb2 {
  private _calcRate!: Rate;
  private _bufferA!: UGenInput;
  private _bufferB!: UGenInput;
  private _numTeeth!: UGenInput;
  private _phase!: UGenInput;
  private _width!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PV_RectComb2 {
    const b = new PV_RectComb2();
    b._calcRate = 'control';
    b._bufferA = { tag: 'constant', val: 0 };
    b._bufferB = { tag: 'constant', val: 0 };
    b._numTeeth = { tag: 'constant', val: 0 };
    b._phase = { tag: 'constant', val: 0 };
    b._width = { tag: 'constant', val: 0.5 };
    return b;
  }

  /** fft buffer A. */
  bufferA(v: UGenInputLike): this {
    this._bufferA = toUGenInput(v);
    return this;
  }

  /** fft buffer B. */
  bufferB(v: UGenInputLike): this {
    this._bufferB = toUGenInput(v);
    return this;
  }

  /** number of teeth in the comb. */
  numTeeth(v: UGenInputLike): this {
    this._numTeeth = toUGenInput(v);
    return this;
  }

  /** starting phase of comb pulse. */
  phase(v: UGenInputLike): this {
    this._phase = toUGenInput(v);
    return this;
  }

  /** pulse width of comb. */
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
    inputs.push(this._bufferA);
    inputs.push(this._bufferB);
    inputs.push(this._numTeeth);
    inputs.push(this._phase);
    inputs.push(this._width);
    const idx = def.addUgen("PV_RectComb2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
