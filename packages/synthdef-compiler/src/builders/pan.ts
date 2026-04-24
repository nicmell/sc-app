// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Equal power panning balances two channels; by panning, you are favouring one
 * or other channel in the mix, and the other loses power. The middle pan
 * position (pos=0.0) corresponds to the original stereo mix; full left (pos of
 * -1) is essentially just left channel playing, full right (pos of 1) just the
 * right. The output of Balance2 remains a stereo signal.
 */
export class Balance2 {
  private _calcRate!: Rate;
  private _left!: UGenInput;
  private _right!: UGenInput;
  private _pos!: UGenInput;
  private _level!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Balance2 {
    const b = new Balance2();
    b._calcRate = 'audio';
    b._left = { tag: 'constant', val: 0 };
    b._right = { tag: 'constant', val: 0 };
    b._pos = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** channel 1 of input stereo signal */
  left(v: UGenInputLike): this {
    this._left = toUGenInput(v);
    return this;
  }

  /** channel 2 of input stereo signal */
  right(v: UGenInputLike): this {
    this._right = toUGenInput(v);
    return this;
  }

  /** pan position, -1 is left, +1 is right */
  pos(v: UGenInputLike): this {
    this._pos = toUGenInput(v);
    return this;
  }

  /** a control rate level input. */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._left);
    inputs.push(this._right);
    inputs.push(this._pos);
    inputs.push(this._level);
    const idx = def.addUgen("Balance2", this._calcRate, inputs, 2, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Encode a two channel signal to two dimensional ambisonic B-format. This puts
 * two channels at opposite poles of a 2D ambisonic field. This is one way to map
 * a stereo sound onto a soundfield. It is equivalent to: PanB2(inA, azimuth,
 * gain) + PanB2(inB, azimuth + 1, gain)
 */
export class BiPanB2 {
  private _calcRate!: Rate;
  private _inA!: UGenInput;
  private _inB!: UGenInput;
  private _azimuth!: UGenInput;
  private _gain!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BiPanB2 {
    const b = new BiPanB2();
    b._calcRate = 'audio';
    b._inA = { tag: 'constant', val: 0 };
    b._inB = { tag: 'constant', val: 0 };
    b._azimuth = { tag: 'constant', val: 0 };
    b._gain = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): BiPanB2 {
    const b = new BiPanB2();
    b._calcRate = 'control';
    b._inA = { tag: 'constant', val: 0 };
    b._inB = { tag: 'constant', val: 0 };
    b._azimuth = { tag: 'constant', val: 0 };
    b._gain = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal A */
  inA(v: UGenInputLike): this {
    this._inA = toUGenInput(v);
    return this;
  }

  /** input signal B */
  inB(v: UGenInputLike): this {
    this._inB = toUGenInput(v);
    return this;
  }

  /**
   * position around the circle from -1 to +1. -1 is behind, -0.5 is left, 0 is
   * forward, +0.5 is right, +1 is behind.
   */
  azimuth(v: UGenInputLike): this {
    this._azimuth = toUGenInput(v);
    return this;
  }

  /** amplitude control */
  gain(v: UGenInputLike): this {
    this._gain = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._inA);
    inputs.push(this._inB);
    inputs.push(this._azimuth);
    inputs.push(this._gain);
    const idx = def.addUgen("BiPanB2", this._calcRate, inputs, 3, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * 2D Ambisonic B-format decoder. Decode a two dimensional ambisonic B-format
 * signal to a set of speakers in a regular polygon. The outputs will be in
 * clockwise order. The position of the first speaker is either center or left of
 * center.
 */
export class DecodeB2 {
  private _calcRate!: Rate;
  private _w!: UGenInput;
  private _x!: UGenInput;
  private _y!: UGenInput;
  private _orientation!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DecodeB2 {
    const b = new DecodeB2();
    b._calcRate = 'audio';
    b._w = { tag: 'constant', val: 0 };
    b._x = { tag: 'constant', val: 0 };
    b._y = { tag: 'constant', val: 0 };
    b._orientation = { tag: 'constant', val: 0.5 };
    b._numChannels = 1;
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DecodeB2 {
    const b = new DecodeB2();
    b._calcRate = 'control';
    b._w = { tag: 'constant', val: 0 };
    b._x = { tag: 'constant', val: 0 };
    b._y = { tag: 'constant', val: 0 };
    b._orientation = { tag: 'constant', val: 0.5 };
    b._numChannels = 1;
    return b;
  }

  /** B-format signal */
  w(v: UGenInputLike): this {
    this._w = toUGenInput(v);
    return this;
  }

  /** B-format signal */
  x(v: UGenInputLike): this {
    this._x = toUGenInput(v);
    return this;
  }

  /** B-format signal */
  y(v: UGenInputLike): this {
    this._y = toUGenInput(v);
    return this;
  }

  /**
   * Should be zero if the front is a vertex of the polygon. The first speaker will
   * be directly in front. Should be 0.5 if the front bisects a side of the
   * polygon. Then the first speaker will be the one left of center. Default is
   * 0.5.
   */
  orientation(v: UGenInputLike): this {
    this._orientation = toUGenInput(v);
    return this;
  }

  /** number of output speakers. Typically 4 to 8. */
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
    inputs.push(this._w);
    inputs.push(this._x);
    inputs.push(this._y);
    inputs.push(this._orientation);
    const idx = def.addUgen("DecodeB2", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Two channel (stereo) linear panner. This one sounds more like the Rhodes
 * tremolo than Pan2.
 */
export class LinPan2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _pos!: UGenInput;
  private _level!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LinPan2 {
    const b = new LinPan2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._pos = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LinPan2 {
    const b = new LinPan2();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._pos = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** pan position, -1 is left, +1 is right */
  pos(v: UGenInputLike): this {
    this._pos = toUGenInput(v);
    return this;
  }

  /** a control rate level input */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._pos);
    inputs.push(this._level);
    const idx = def.addUgen("LinPan2", this._calcRate, inputs, 2, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Two channel linear crossfader. */
export class LinXFade2 {
  private _calcRate!: Rate;
  private _inA!: UGenInput;
  private _inB!: UGenInput;
  private _pan!: UGenInput;
  private _level!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LinXFade2 {
    const b = new LinXFade2();
    b._calcRate = 'audio';
    b._inA = { tag: 'constant', val: 0 };
    b._inB = { tag: 'constant', val: 0 };
    b._pan = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LinXFade2 {
    const b = new LinXFade2();
    b._calcRate = 'control';
    b._inA = { tag: 'constant', val: 0 };
    b._inB = { tag: 'constant', val: 0 };
    b._pan = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal A */
  inA(v: UGenInputLike): this {
    this._inA = toUGenInput(v);
    return this;
  }

  /** input signal B */
  inB(v: UGenInputLike): this {
    this._inB = toUGenInput(v);
    return this;
  }

  /** cross fade position from -1 to +1 */
  pan(v: UGenInputLike): this {
    this._pan = toUGenInput(v);
    return this;
  }

  /** a control rate level input */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._inA);
    inputs.push(this._inB);
    inputs.push(this._pan);
    inputs.push(this._level);
    const idx = def.addUgen("LinXFade2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Two channel (stereo) equal power panner. */
export class Pan2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _pos!: UGenInput;
  private _level!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Pan2 {
    const b = new Pan2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._pos = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Pan2 {
    const b = new Pan2();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._pos = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** pan position, -1 is left, +1 is right */
  pos(v: UGenInputLike): this {
    this._pos = toUGenInput(v);
    return this;
  }

  /** a control rate level input */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._pos);
    inputs.push(this._level);
    const idx = def.addUgen("Pan2", this._calcRate, inputs, 2, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Four channel equal power panner. Outputs are in order LeftFront, RightFront,
 * LeftBack, RightBack.
 */
export class Pan4 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _xpos!: UGenInput;
  private _ypos!: UGenInput;
  private _level!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Pan4 {
    const b = new Pan4();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._xpos = { tag: 'constant', val: 0 };
    b._ypos = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Pan4 {
    const b = new Pan4();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._xpos = { tag: 'constant', val: 0 };
    b._ypos = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** x pan position from -1 to +1 (left to right) */
  xpos(v: UGenInputLike): this {
    this._xpos = toUGenInput(v);
    return this;
  }

  /** y pan position from -1 to +1 (back to front) */
  ypos(v: UGenInputLike): this {
    this._ypos = toUGenInput(v);
    return this;
  }

  /** a control rate level input. */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._xpos);
    inputs.push(this._ypos);
    inputs.push(this._level);
    const idx = def.addUgen("Pan4", this._calcRate, inputs, 4, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Multichannel equal power panner. */
export class PanAz {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _pos!: UGenInput;
  private _level!: UGenInput;
  private _width!: UGenInput;
  private _orientation!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PanAz {
    const b = new PanAz();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._pos = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    b._width = { tag: 'constant', val: 2 };
    b._orientation = { tag: 'constant', val: 0.5 };
    b._numChannels = 1;
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): PanAz {
    const b = new PanAz();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._pos = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    b._width = { tag: 'constant', val: 2 };
    b._orientation = { tag: 'constant', val: 0.5 };
    b._numChannels = 1;
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * pan position. Channels are evenly spaced over a cyclic period of 2.0 with 0.0
   * equal to the position directly in front, 2.0/numChans a clockwise shift
   * 1/numChans of the way around the ring, 4.0/numChans equal to a shift of
   * 2/numChans, etc. Thus all channels will be cyclically panned through if a
   * sawtooth wave from -1 to +1 is used to modulate the pos. N.B. Front may or may
   * not correspond to a speaker depending on the setting of the orientation arg,
   * see below.
   */
  pos(v: UGenInputLike): this {
    this._pos = toUGenInput(v);
    return this;
  }

  /** a control rate level input. */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /**
   * The width of the panning envelope. Nominally this is 2.0 which pans between
   * pairs of adjacent speakers. Width values greater than two will spread the pan
   * over greater numbers of speakers. Width values less than one will leave silent
   * gaps between speakers.
   */
  width(v: UGenInputLike): this {
    this._width = toUGenInput(v);
    return this;
  }

  /**
   * Should be zero if the front is a vertex of the polygon. The first speaker will
   * be directly in front. Should be 0.5 if the front bisects a side of the
   * polygon. Then the first speaker will be the one left of center. Default is
   * 0.5.
   */
  orientation(v: UGenInputLike): this {
    this._orientation = toUGenInput(v);
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
    inputs.push(this._in);
    inputs.push(this._pos);
    inputs.push(this._level);
    inputs.push(this._width);
    inputs.push(this._orientation);
    const idx = def.addUgen("PanAz", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Ambisonic B format panner. Output channels are in order W,X,Y,Z. */
export class PanB {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _azimuth!: UGenInput;
  private _elevation!: UGenInput;
  private _gain!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PanB {
    const b = new PanB();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._azimuth = { tag: 'constant', val: 0 };
    b._elevation = { tag: 'constant', val: 0 };
    b._gain = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): PanB {
    const b = new PanB();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._azimuth = { tag: 'constant', val: 0 };
    b._elevation = { tag: 'constant', val: 0 };
    b._gain = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** in radians, -pi to +pi */
  azimuth(v: UGenInputLike): this {
    this._azimuth = toUGenInput(v);
    return this;
  }

  /** in radians, -0.5pi to +0.5pi */
  elevation(v: UGenInputLike): this {
    this._elevation = toUGenInput(v);
    return this;
  }

  /** a control rate level input */
  gain(v: UGenInputLike): this {
    this._gain = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._azimuth);
    inputs.push(this._elevation);
    inputs.push(this._gain);
    const idx = def.addUgen("PanB", this._calcRate, inputs, 4, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Encode a mono signal to two dimensional ambisonic B-format. */
export class PanB2 {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _azimuth!: UGenInput;
  private _gain!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): PanB2 {
    const b = new PanB2();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._azimuth = { tag: 'constant', val: 0 };
    b._gain = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): PanB2 {
    const b = new PanB2();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._azimuth = { tag: 'constant', val: 0 };
    b._gain = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * position around the circle from -1 to +1. -1 is behind, -0.5 is left, 0 is
   * forward, +0.5 is right, +1 is behind.
   */
  azimuth(v: UGenInputLike): this {
    this._azimuth = toUGenInput(v);
    return this;
  }

  /** amplitude control */
  gain(v: UGenInputLike): this {
    this._gain = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._azimuth);
    inputs.push(this._gain);
    const idx = def.addUgen("PanB2", this._calcRate, inputs, 3, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Rotate2 can be used for rotating an ambisonic B-format sound field around an
 * axis. Rotate2 does an equal power rotation so it also works well on stereo
 * sounds. It takes two audio inputs (x, y) and an angle control (pos). It
 * outputs two channels (x, y). It computes this: xout = cos(angle) * xin +
 * sin(angle) * yin; yout = cos(angle) * yin - sin(angle) * xin; where angle =
 * pos * pi, so that -1 becomes -pi and +1 becomes +pi. This allows you to use an
 * LFSaw to do continuous rotation around a circle.
 */
export class Rotate2 {
  private _calcRate!: Rate;
  private _x!: UGenInput;
  private _y!: UGenInput;
  private _pos!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Rotate2 {
    const b = new Rotate2();
    b._calcRate = 'audio';
    b._x = { tag: 'constant', val: 0 };
    b._y = { tag: 'constant', val: 0 };
    b._pos = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Rotate2 {
    const b = new Rotate2();
    b._calcRate = 'control';
    b._x = { tag: 'constant', val: 0 };
    b._y = { tag: 'constant', val: 0 };
    b._pos = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal */
  x(v: UGenInputLike): this {
    this._x = toUGenInput(v);
    return this;
  }

  /** input signal */
  y(v: UGenInputLike): this {
    this._y = toUGenInput(v);
    return this;
  }

  /**
   * angle to rotate around the circle from -1 to +1. -1 is 180 degrees, -0.5 is
   * left, 0 is forward, +0.5 is right, +1 is behind.
   */
  pos(v: UGenInputLike): this {
    this._pos = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._x);
    inputs.push(this._y);
    inputs.push(this._pos);
    const idx = def.addUgen("Rotate2", this._calcRate, inputs, 2, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Equal power two channel cross fade */
export class XFade2 {
  private _calcRate!: Rate;
  private _inA!: UGenInput;
  private _inB!: UGenInput;
  private _pan!: UGenInput;
  private _level!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): XFade2 {
    const b = new XFade2();
    b._calcRate = 'audio';
    b._inA = { tag: 'constant', val: 0 };
    b._inB = { tag: 'constant', val: 0 };
    b._pan = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): XFade2 {
    const b = new XFade2();
    b._calcRate = 'control';
    b._inA = { tag: 'constant', val: 0 };
    b._inB = { tag: 'constant', val: 0 };
    b._pan = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal A */
  inA(v: UGenInputLike): this {
    this._inA = toUGenInput(v);
    return this;
  }

  /** input signal B */
  inB(v: UGenInputLike): this {
    this._inB = toUGenInput(v);
    return this;
  }

  /**
   * Pan between the two input signals with -1 being inA only and 1 being inB only
   * with values between being a mix of the two.
   */
  pan(v: UGenInputLike): this {
    this._pan = toUGenInput(v);
    return this;
  }

  /** Output level - 0 being silent and 1 being original volume */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._inA);
    inputs.push(this._inB);
    inputs.push(this._pan);
    inputs.push(this._level);
    const idx = def.addUgen("XFade2", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
