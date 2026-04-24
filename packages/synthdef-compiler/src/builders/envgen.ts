// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/** Outputs a one when the src ugen (typically an envelope) has finished */
export class Done {
  private _calcRate!: Rate;
  private _src!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): Done {
    const b = new Done();
    b._calcRate = 'control';
    b._src = { tag: 'constant', val: 0 };
    return b;
  }

  /** ugen to monitor */
  src(v: UGenInputLike): this {
    this._src = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._src);
    const idx = def.addUgen("Done", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * envelope generator, interpolates across a path of control points over time,
 * see the overtone.sc.envelope functions to generate the control points array
 * Note: The actual minimum duration of a segment is not zero, but one sample
 * step for audio rate and one block for control rate. This may result in
 * asynchronicity when in two envelopes of different number of levels, the
 * envelope times add up to the same total duration. Similarly, when modulating
 * times, the new time is only updated at the end of the current segment - this
 * may lead to asynchronicity of two envelopes with modulated times.
 */
export class EnvGen {
  private _calcRate!: Rate;
  private _envelope!: UGenInput;
  private _gate!: UGenInput;
  private _levelScale!: UGenInput;
  private _levelBias!: UGenInput;
  private _timeScale!: UGenInput;
  private _action!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): EnvGen {
    const b = new EnvGen();
    b._calcRate = 'audio';
    b._envelope = { tag: 'constant', val: 0 };
    b._gate = { tag: 'constant', val: 1 };
    b._levelScale = { tag: 'constant', val: 1 };
    b._levelBias = { tag: 'constant', val: 0 };
    b._timeScale = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): EnvGen {
    const b = new EnvGen();
    b._calcRate = 'control';
    b._envelope = { tag: 'constant', val: 0 };
    b._gate = { tag: 'constant', val: 1 };
    b._levelScale = { tag: 'constant', val: 1 };
    b._levelBias = { tag: 'constant', val: 0 };
    b._timeScale = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** an Array of Controls. */
  envelope(v: UGenInputLike): this {
    this._envelope = toUGenInput(v);
    return this;
  }

  /**
   * this triggers the envelope and holds it open while > 0. If the envelope is
   * fixed-length (e.g. perc), the gate argument is used as a simple trigger. If it
   * is an sustaining envelope (e.g. adsr, asr), the envelope is held open until
   * the gate becomes 0, at which point is released. If the gate of an env-gen is
   * set to -1 or below, then the envelope will cutoff immediately. The time for it
   * to cutoff is the amount less than -1, with -1 being as fast as possible, -1.5
   * being a cutoff in 0.5 seconds, etc. The cutoff shape is linear.
   */
  gate(v: UGenInputLike): this {
    this._gate = toUGenInput(v);
    return this;
  }

  /** scales the levels of the breakpoints. */
  levelScale(v: UGenInputLike): this {
    this._levelScale = toUGenInput(v);
    return this;
  }

  /** offsets the levels of the breakpoints. */
  levelBias(v: UGenInputLike): this {
    this._levelBias = toUGenInput(v);
    return this;
  }

  /** scales the durations of the segments. */
  timeScale(v: UGenInputLike): this {
    this._timeScale = toUGenInput(v);
    return this;
  }

  /**
   * an integer representing an action to be executed when the env is finished
   * playing. This can be used to free the enclosing synth, etc.
   */
  action(v: UGenInputLike): this {
    this._action = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._envelope);
    inputs.push(this._gate);
    inputs.push(this._levelScale);
    inputs.push(this._levelBias);
    inputs.push(this._timeScale);
    inputs.push(this._action);
    const idx = def.addUgen("EnvGen", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Free the specified node when triggered */
export class Free {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _id!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): Free {
    const b = new Free();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._id = { tag: 'constant', val: 0 };
    return b;
  }

  /** when triggered, frees node */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** node to be freed */
  id(v: UGenInputLike): this {
    this._id = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._id);
    const idx = def.addUgen("Free", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Free the enclosing synth when triggered */
export class FreeSelf {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): FreeSelf {
    const b = new FreeSelf();
    b._calcRate = 'control';
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
    const idx = def.addUgen("FreeSelf", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Free the enclosing synth when the src ugen finishes (e.g. env-gen, play-buf,
 * linen...)
 */
export class FreeSelfWhenDone {
  private _calcRate!: Rate;
  private _src!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): FreeSelfWhenDone {
    const b = new FreeSelfWhenDone();
    b._calcRate = 'control';
    b._src = { tag: 'constant', val: 0 };
    return b;
  }

  /** the ugen to check for done */
  src(v: UGenInputLike): this {
    this._src = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._src);
    const idx = def.addUgen("FreeSelfWhenDone", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class IEnvGen {
  private _calcRate!: Rate;
  private _ienvelope!: UGenInput;
  private _index!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): IEnvGen {
    const b = new IEnvGen();
    b._calcRate = 'audio';
    b._ienvelope = { tag: 'constant', val: 0 };
    b._index = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): IEnvGen {
    const b = new IEnvGen();
    b._calcRate = 'control';
    b._ienvelope = { tag: 'constant', val: 0 };
    b._index = { tag: 'constant', val: 0 };
    return b;
  }

  /** an InterplEnv (this is static for the life of the UGen) */
  ienvelope(v: UGenInputLike): this {
    this._ienvelope = toUGenInput(v);
    return this;
  }

  /** a point to access within the InterplEnv */
  index(v: UGenInputLike): this {
    this._index = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._ienvelope);
    inputs.push(this._index);
    const idx = def.addUgen("IEnvGen", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A linear envelope generator, rises to sus-level over attack-time seconds and
 * after the gate goes non-positive falls over release-time to finally perform
 * the (optional) action
 */
export class Linen {
  private _calcRate!: Rate;
  private _gate!: UGenInput;
  private _attackTime!: UGenInput;
  private _susLevel!: UGenInput;
  private _releaseTime!: UGenInput;
  private _action!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): Linen {
    const b = new Linen();
    b._calcRate = 'control';
    b._gate = { tag: 'constant', val: 1 };
    b._attackTime = { tag: 'constant', val: 0.01 };
    b._susLevel = { tag: 'constant', val: 1 };
    b._releaseTime = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Input trigger */
  gate(v: UGenInputLike): this {
    this._gate = toUGenInput(v);
    return this;
  }

  /** Time taken to rise to susLevel in seconds */
  attackTime(v: UGenInputLike): this {
    this._attackTime = toUGenInput(v);
    return this;
  }

  /** Level to hold the envelope at until gate is triggered */
  susLevel(v: UGenInputLike): this {
    this._susLevel = toUGenInput(v);
    return this;
  }

  /** Time to fall from susLevel back to 0 after the gate has been triggered */
  releaseTime(v: UGenInputLike): this {
    this._releaseTime = toUGenInput(v);
    return this;
  }

  /** done action */
  action(v: UGenInputLike): this {
    this._action = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._gate);
    inputs.push(this._attackTime);
    inputs.push(this._susLevel);
    inputs.push(this._releaseTime);
    inputs.push(this._action);
    const idx = def.addUgen("Linen", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Pause a specified node when triggered */
export class Pause {
  private _calcRate!: Rate;
  private _gate!: UGenInput;
  private _id!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): Pause {
    const b = new Pause();
    b._calcRate = 'control';
    b._gate = { tag: 'constant', val: 0 };
    b._id = { tag: 'constant', val: 0 };
    return b;
  }

  /** when gate is 0, node is paused, when 1 it runs */
  gate(v: UGenInputLike): this {
    this._gate = toUGenInput(v);
    return this;
  }

  /** node to be paused */
  id(v: UGenInputLike): this {
    this._id = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._gate);
    inputs.push(this._id);
    const idx = def.addUgen("Pause", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** Pause the enclosing synth when triggered */
export class PauseSelf {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PauseSelf {
    const b = new PauseSelf();
    b._calcRate = 'control';
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
    const idx = def.addUgen("PauseSelf", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Pause the enclosing synth when the src ugen finishes (e.g. env-gen, play-buf,
 * linen...)
 */
export class PauseSelfWhenDone {
  private _calcRate!: Rate;
  private _src!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): PauseSelfWhenDone {
    const b = new PauseSelfWhenDone();
    b._calcRate = 'control';
    b._src = { tag: 'constant', val: 0 };
    return b;
  }

  /** the ugen to check for done */
  src(v: UGenInputLike): this {
    this._src = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._src);
    const idx = def.addUgen("PauseSelfWhenDone", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
