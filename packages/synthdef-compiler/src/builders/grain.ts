// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/** Granular synthesis with sound stored in a buffer */
export class GrainBuf {
  private _calcRate!: Rate;
  private _trigger!: UGenInput;
  private _dur!: UGenInput;
  private _sndbuf!: UGenInput;
  private _rate!: UGenInput;
  private _pos!: UGenInput;
  private _interp!: UGenInput;
  private _pan!: UGenInput;
  private _envbufnum!: UGenInput;
  private _maxGrains!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): GrainBuf {
    const b = new GrainBuf();
    b._calcRate = 'audio';
    b._trigger = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 1 };
    b._sndbuf = { tag: 'constant', val: 0 };
    b._rate = { tag: 'constant', val: 1 };
    b._pos = { tag: 'constant', val: 1 };
    b._interp = { tag: 'constant', val: 2 };
    b._pan = { tag: 'constant', val: 0 };
    b._envbufnum = { tag: 'constant', val: -1 };
    b._maxGrains = { tag: 'constant', val: 512 };
    b._numChannels = 1;
    return b;
  }

  /**
   * a kr or ar trigger to start a new grain. If ar, grains after the start of the
   * synth are sample accurate.
   */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /** size of the grain (in seconds). */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /**
   * the buffer holding a mono audio signal. If using multi-channel files, use
   * Buffer.readChannel.
   */
  sndbuf(v: UGenInputLike): this {
    this._sndbuf = toUGenInput(v);
    return this;
  }

  /** the playback rate of the sampled sound */
  rate(v: UGenInputLike): this {
    this._rate = toUGenInput(v);
    return this;
  }

  /**
   * the playback position for the grain to start with (0 is beginning, 1 is end of
   * file)
   */
  pos(v: UGenInputLike): this {
    this._pos = toUGenInput(v);
    return this;
  }

  /**
   * the interpolation method used for pitchshifting grains: 1 = no interpolation 2
   * = linear 4 = cubic interpolation (more computationally intensive)
   */
  interp(v: UGenInputLike): this {
    this._interp = toUGenInput(v);
    return this;
  }

  /**
   * Determines where to pan the output. If num-channels = 1, no panning is done;
   * if num-channels = 2, panning is similar to Pan2; if num-channels > 2, pannins
   * is the same as PanAz.
   */
  pan(v: UGenInputLike): this {
    this._pan = toUGenInput(v);
    return this;
  }

  /**
   * the buffer number containing a singal to use for the grain envelope. -1 uses a
   * built-in Hanning envelope.
   */
  envbufnum(v: UGenInputLike): this {
    this._envbufnum = toUGenInput(v);
    return this;
  }

  /**
   * the maximum number of overlapping grains that can be used at a given time.
   * This value is set at the UGens init time and can't be modified. This can be
   * set lower for more efficient use of memory.
   */
  maxGrains(v: UGenInputLike): this {
    this._maxGrains = toUGenInput(v);
    return this;
  }

  /** the number of channels to output. If 1, mono is returned and pan is ignored. */
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
    inputs.push(this._dur);
    inputs.push(this._sndbuf);
    inputs.push(this._rate);
    inputs.push(this._pos);
    inputs.push(this._interp);
    inputs.push(this._pan);
    inputs.push(this._envbufnum);
    inputs.push(this._maxGrains);
    const idx = def.addUgen("GrainBuf", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Granular synthesis with frequency modulated sine tones */
export class GrainFM {
  private _calcRate!: Rate;
  private _trigger!: UGenInput;
  private _dur!: UGenInput;
  private _carFreq!: UGenInput;
  private _modFreq!: UGenInput;
  private _index!: UGenInput;
  private _pan!: UGenInput;
  private _envbufnum!: UGenInput;
  private _maxGrains!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): GrainFM {
    const b = new GrainFM();
    b._calcRate = 'audio';
    b._trigger = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 1 };
    b._carFreq = { tag: 'constant', val: 440 };
    b._modFreq = { tag: 'constant', val: 440 };
    b._index = { tag: 'constant', val: 1 };
    b._pan = { tag: 'constant', val: 0 };
    b._envbufnum = { tag: 'constant', val: -1 };
    b._maxGrains = { tag: 'constant', val: 512 };
    b._numChannels = 1;
    return b;
  }

  /**
   * a kr or ar trigger to start a new grain. If ar, grains after the start of the
   * synth are sample accurate.
   */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /** size of the grain. */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /** the frequency of the FM grain's carrier oscillator */
  carFreq(v: UGenInputLike): this {
    this._carFreq = toUGenInput(v);
    return this;
  }

  /** the frequency of the FM grain's modulating oscillator */
  modFreq(v: UGenInputLike): this {
    this._modFreq = toUGenInput(v);
    return this;
  }

  /** the FM index */
  index(v: UGenInputLike): this {
    this._index = toUGenInput(v);
    return this;
  }

  /**
   * Determines where to pan the output. If num-channels = 1, no panning is done;
   * if num-channels = 2, panning is similar to Pan2; if numChannels > 2, pannins
   * is the same as PanAz.
   */
  pan(v: UGenInputLike): this {
    this._pan = toUGenInput(v);
    return this;
  }

  /**
   * the buffer number containing a singal to use for the grain envelope. -1 uses a
   * built-in Hanning envelope.
   */
  envbufnum(v: UGenInputLike): this {
    this._envbufnum = toUGenInput(v);
    return this;
  }

  /**
   * the maximum number of overlapping grains that can be used at a given time.
   * This value is set at the UGens init time and can't be modified. This can be
   * set lower for more efficient use of memory.
   */
  maxGrains(v: UGenInputLike): this {
    this._maxGrains = toUGenInput(v);
    return this;
  }

  /** the number of channels to output. If 1, mono is returned and pan is ignored. */
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
    inputs.push(this._dur);
    inputs.push(this._carFreq);
    inputs.push(this._modFreq);
    inputs.push(this._index);
    inputs.push(this._pan);
    inputs.push(this._envbufnum);
    inputs.push(this._maxGrains);
    const idx = def.addUgen("GrainFM", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Granulate an input signal */
export class GrainIn {
  private _calcRate!: Rate;
  private _trigger!: UGenInput;
  private _dur!: UGenInput;
  private _in!: UGenInput;
  private _pan!: UGenInput;
  private _envbufnum!: UGenInput;
  private _maxGrains!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): GrainIn {
    const b = new GrainIn();
    b._calcRate = 'audio';
    b._trigger = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 1 };
    b._in = { tag: 'constant', val: 0 };
    b._pan = { tag: 'constant', val: 0 };
    b._envbufnum = { tag: 'constant', val: -1 };
    b._maxGrains = { tag: 'constant', val: 512 };
    b._numChannels = 1;
    return b;
  }

  /**
   * a kr or ar trigger to start a new grain. If ar, grains after the start of the
   * synth are sample accurate.
   */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /** size of the grain. */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /** the input to granulate */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /**
   * Determines where to pan the output. If num-channels = 1, no panning is done;
   * if num-channels = 2, panning is similar to Pan2; if num-channels > 2, pannins
   * is the same as PanAz.
   */
  pan(v: UGenInputLike): this {
    this._pan = toUGenInput(v);
    return this;
  }

  /**
   * the buffer number containing a singal to use for the grain envelope. -1 uses a
   * built-in Hanning envelope.
   */
  envbufnum(v: UGenInputLike): this {
    this._envbufnum = toUGenInput(v);
    return this;
  }

  /**
   * the maximum number of overlapping grains that can be used at a given time.
   * This value is set at the UGens init time and can't be modified. This can be
   * set lower for more efficient use of memory.
   */
  maxGrains(v: UGenInputLike): this {
    this._maxGrains = toUGenInput(v);
    return this;
  }

  /** the number of channels to output. If 1, mono is returned and pan is ignored. */
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
    inputs.push(this._dur);
    inputs.push(this._in);
    inputs.push(this._pan);
    inputs.push(this._envbufnum);
    inputs.push(this._maxGrains);
    const idx = def.addUgen("GrainIn", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Granular synthesis with sine tones */
export class GrainSin {
  private _calcRate!: Rate;
  private _trigger!: UGenInput;
  private _dur!: UGenInput;
  private _freq!: UGenInput;
  private _pan!: UGenInput;
  private _envbufnum!: UGenInput;
  private _maxGrains!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): GrainSin {
    const b = new GrainSin();
    b._calcRate = 'audio';
    b._trigger = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 1 };
    b._freq = { tag: 'constant', val: 440 };
    b._pan = { tag: 'constant', val: 0 };
    b._envbufnum = { tag: 'constant', val: -1 };
    b._maxGrains = { tag: 'constant', val: 512 };
    b._numChannels = 1;
    return b;
  }

  /**
   * a kr or ar trigger to start a new grain. If ar, grains after the start of the
   * synth are sample accurate.
   */
  trigger(v: UGenInputLike): this {
    this._trigger = toUGenInput(v);
    return this;
  }

  /** size of the grain. */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /** the frequency of the grain's oscillator */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * Determines where to pan the output. If num-channels = 1, no panning is done;
   * if num-channels = 2, panning is similar to Pan2; if numChannels > 2, pannins
   * is the same as PanAz.
   */
  pan(v: UGenInputLike): this {
    this._pan = toUGenInput(v);
    return this;
  }

  /**
   * the buffer number containing a singal to use for the grain envelope. -1 uses a
   * built-in Hanning envelope.
   */
  envbufnum(v: UGenInputLike): this {
    this._envbufnum = toUGenInput(v);
    return this;
  }

  /**
   * the maximum number of overlapping grains that can be used at a given time.
   * This value is set at the UGens init time and can't be modified. This can be
   * set lower for more efficient use of memory.
   */
  maxGrains(v: UGenInputLike): this {
    this._maxGrains = toUGenInput(v);
    return this;
  }

  /** the number of channels to output. If 1, mono is returned and pan is ignored. */
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
    inputs.push(this._dur);
    inputs.push(this._freq);
    inputs.push(this._pan);
    inputs.push(this._envbufnum);
    inputs.push(this._maxGrains);
    const idx = def.addUgen("GrainSin", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A granular time stretcher and pitchshifter. Inspired by Chad Kirby's
 * SuperCollider2 Warp1 class, which was inspired by Richard Karpen's sndwarp for
 * CSound.
 */
export class Warp1 {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _pointer!: UGenInput;
  private _freqScale!: UGenInput;
  private _windowSize!: UGenInput;
  private _envbufnum!: UGenInput;
  private _overlaps!: UGenInput;
  private _windowRandRatio!: UGenInput;
  private _interp!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Warp1 {
    const b = new Warp1();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._pointer = { tag: 'constant', val: 0 };
    b._freqScale = { tag: 'constant', val: 1 };
    b._windowSize = { tag: 'constant', val: 0.1 };
    b._envbufnum = { tag: 'constant', val: -1 };
    b._overlaps = { tag: 'constant', val: 8 };
    b._windowRandRatio = { tag: 'constant', val: 0 };
    b._interp = { tag: 'constant', val: 1 };
    b._numChannels = 1;
    return b;
  }

  /** the buffer number of a mono soundfile. */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /**
   * the position in the buffer. The value should be between 0 and 1, with 0 being
   * the begining of the buffer, and 1 the end.
   */
  pointer(v: UGenInputLike): this {
    this._pointer = toUGenInput(v);
    return this;
  }

  /**
   * the amount of frequency shift. 1.0 is normal, 0.5 is one octave down, 2.0 is
   * one octave up. Negative values play the soundfile backwards.
   */
  freqScale(v: UGenInputLike): this {
    this._freqScale = toUGenInput(v);
    return this;
  }

  /** the size of each grain window. */
  windowSize(v: UGenInputLike): this {
    this._windowSize = toUGenInput(v);
    return this;
  }

  /**
   * the buffer number containing a singal to use for the grain envelope. -1 uses a
   * built-in Hanning envelope.
   */
  envbufnum(v: UGenInputLike): this {
    this._envbufnum = toUGenInput(v);
    return this;
  }

  /** the number of overlaping windows. */
  overlaps(v: UGenInputLike): this {
    this._overlaps = toUGenInput(v);
    return this;
  }

  /**
   * the amount of randomness to the windowing function. Must be between 0 (no
   * randomness) to 1.0 (probably to random actually)
   */
  windowRandRatio(v: UGenInputLike): this {
    this._windowRandRatio = toUGenInput(v);
    return this;
  }

  /**
   * the interpolation method used for pitchshifting grains. 1 = no interpolation.
   * 2 = linear. 4 = cubic interpolation (more computationally intensive).
   */
  interp(v: UGenInputLike): this {
    this._interp = toUGenInput(v);
    return this;
  }

  /** the number of channels in the soundfile used in bufnum. */
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
    inputs.push(this._pointer);
    inputs.push(this._freqScale);
    inputs.push(this._windowSize);
    inputs.push(this._envbufnum);
    inputs.push(this._overlaps);
    inputs.push(this._windowRandRatio);
    inputs.push(this._interp);
    const idx = def.addUgen("Warp1", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}
