// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/** All pass filter based on the Second Order Section (SOS) biquad UGen */
export class BAllPass {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BAllPass {
    const b = new BAllPass();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 1200 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed. */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** center frequency. */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the reciprocal of Q. bandwidth / cutoffFreq. */
  rq(v: UGenInputLike): this {
    this._rq = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._rq);
    const idx = def.addUgen("BAllPass", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Band pass filter based on the Second Order Section (SOS) biquad UGen */
export class BBandPass {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _bw!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BBandPass {
    const b = new BBandPass();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 1200 };
    b._bw = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** center frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the bandwidth in octaves between -3 dB frequencies */
  bw(v: UGenInputLike): this {
    this._bw = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._bw);
    const idx = def.addUgen("BBandPass", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Band reject filter based on the Second Order Section (SOS) biquad UGen */
export class BBandStop {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _bw!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BBandStop {
    const b = new BBandStop();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 1200 };
    b._bw = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** center frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the bandwidth in octaves between -3 dB frequencies */
  bw(v: UGenInputLike): this {
    this._bw = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._bw);
    const idx = def.addUgen("BBandStop", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * 12db/oct rolloff - 2nd order resonant Hi Pass Filter based on the Second Order
 * Section (SOS) biquad UGen.
 */
export class BHiPass {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BHiPass {
    const b = new BHiPass();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 1200 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** cutoff frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the reciprocal of Q. bandwidth / cutoffFreq */
  rq(v: UGenInputLike): this {
    this._rq = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._rq);
    const idx = def.addUgen("BHiPass", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Hi shelfbased on the Second Order Section (SOS) biquad UGen */
export class BHiShelf {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rs!: UGenInput;
  private _db!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BHiShelf {
    const b = new BHiShelf();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 1200 };
    b._rs = { tag: 'constant', val: 1 };
    b._db = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** center frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * the reciprocal of S. Shell boost/cut slope. When S = 1, the shelf slope is as
   * steep as it can be and remain monotonically increasing or decreasing gain with
   * frequency. The shelf slope, in dB/octave, remains proportional to S for all
   * other values for a fixed freq/SampleRate.ir and db.
   */
  rs(v: UGenInputLike): this {
    this._rs = toUGenInput(v);
    return this;
  }

  /** gain. boost/cut the center frequency in dBs */
  db(v: UGenInputLike): this {
    this._db = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._rs);
    inputs.push(this._db);
    const idx = def.addUgen("BHiShelf", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * 12db/oct rolloff - 2nd order resonant Low Pass Filter based on the Second
 * Order Section (SOS) biquad UGen
 */
export class BLowPass {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rq!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BLowPass {
    const b = new BLowPass();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 1200 };
    b._rq = { tag: 'constant', val: 1 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** cutoff frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the reciprocal of Q. bandwidth / cutoffFreq */
  rq(v: UGenInputLike): this {
    this._rq = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._rq);
    const idx = def.addUgen("BLowPass", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Low shelf based on the Second Order Section (SOS) biquad UGen */
export class BLowShelf {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rs!: UGenInput;
  private _db!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BLowShelf {
    const b = new BLowShelf();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 1200 };
    b._rs = { tag: 'constant', val: 1 };
    b._db = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** center frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /**
   * the reciprocal of S. Shell boost/cut slope. When S = 1, the shelf slope is as
   * steep as it can be and remain monotonically increasing or decreasing gain with
   * frequency. The shelf slope, in dB/octave, remains proportional to S for all
   * other values for a fixed freq/SampleRate.ir and db.
   */
  rs(v: UGenInputLike): this {
    this._rs = toUGenInput(v);
    return this;
  }

  /** gain. boost/cut the center frequency in dBs */
  db(v: UGenInputLike): this {
    this._db = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._rs);
    inputs.push(this._db);
    const idx = def.addUgen("BLowShelf", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Parametric equalizer based on the Second Order Section (SOS) biquad UGen */
export class BPeakEQ {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _freq!: UGenInput;
  private _rq!: UGenInput;
  private _db!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): BPeakEQ {
    const b = new BPeakEQ();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._freq = { tag: 'constant', val: 1200 };
    b._rq = { tag: 'constant', val: 1 };
    b._db = { tag: 'constant', val: 0 };
    return b;
  }

  /** input signal to be processed */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** center frequency */
  freq(v: UGenInputLike): this {
    this._freq = toUGenInput(v);
    return this;
  }

  /** the reciprocal of Q. bandwidth / cutoffFreq */
  rq(v: UGenInputLike): this {
    this._rq = toUGenInput(v);
    return this;
  }

  /** boost/cut the center frequency (in dBs) */
  db(v: UGenInputLike): this {
    this._db = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._freq);
    inputs.push(this._rq);
    inputs.push(this._db);
    const idx = def.addUgen("BPeakEQ", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
