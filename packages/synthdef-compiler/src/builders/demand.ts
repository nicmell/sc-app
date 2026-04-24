// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * dbrown cgen instead.
 */
export class Dbrown {
  private _calcRate!: Rate;
  private _length!: UGenInput;
  private _lo!: UGenInput;
  private _hi!: UGenInput;
  private _step!: UGenInput;

  private constructor() {}

  /** Default: positive infinity */
  length(v: UGenInputLike): this {
    this._length = toUGenInput(v);
    return this;
  }

  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  step(v: UGenInputLike): this {
    this._step = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._length);
    inputs.push(this._lo);
    inputs.push(this._hi);
    inputs.push(this._step);
    const idx = def.addUgen("Dbrown", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Read values from a buffer on demand, using phase (index) value that is also
 * pulled on demand. All inputs can be either demand ugen or any other ugen.
 */
export class Dbufrd {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _phase!: UGenInput;
  private _loop!: UGenInput;

  private constructor() {}

  /** buffer number to read from */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /** index into the buffer */
  phase(v: UGenInputLike): this {
    this._phase = toUGenInput(v);
    return this;
  }

  /** when phase exceeds number of frames in buffer, loops when set to 1 */
  loop(v: UGenInputLike): this {
    this._loop = toUGenInput(v);
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
    const idx = def.addUgen("Dbufrd", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * dbufwr cgen instead.
 */
export class Dbufwr {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _phase!: UGenInput;
  private _input!: UGenInput;
  private _loop!: UGenInput;

  private constructor() {}

  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  phase(v: UGenInputLike): this {
    this._phase = toUGenInput(v);
    return this;
  }

  input(v: UGenInputLike): this {
    this._input = toUGenInput(v);
    return this;
  }

  loop(v: UGenInputLike): this {
    this._loop = toUGenInput(v);
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
    inputs.push(this._input);
    inputs.push(this._loop);
    const idx = def.addUgen("Dbufwr", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * On every trigger it demands the next value from each of the demand ugens
 * passed as args. Used to pull values from the other demand rate ugens. By
 * design, a reset trigger only resets the demand ugens; it does not reset the
 * value at Demand's output. Demand continues to hold its value until the next
 * value is demanded, at which point its output value will be the first expected
 * item in the list.
 */
export class Demand {
  private _calcRate!: Rate;
  private _trig!: UGenInput;
  private _reset!: UGenInput;
  private _demandUgens!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Demand {
    const b = new Demand();
    b._calcRate = 'audio';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    b._demandUgens = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Demand {
    const b = new Demand();
    b._calcRate = 'control';
    b._trig = { tag: 'constant', val: 0 };
    b._reset = { tag: 'constant', val: 0 };
    b._demandUgens = { tag: 'constant', val: 0 };
    return b;
  }

  /**
   * Can be any signal. A trigger happens when the signal changes from non-positive
   * to positive.
   */
  trig(v: UGenInputLike): this {
    this._trig = toUGenInput(v);
    return this;
  }

  /** Resets the list of ugens when triggered. */
  reset(v: UGenInputLike): this {
    this._reset = toUGenInput(v);
    return this;
  }

  /** list of demand rate ugens */
  demandUgens(v: UGenInputLike): this {
    this._demandUgens = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._trig);
    inputs.push(this._reset);
    inputs.push(this._demandUgens);
    const idx = def.addUgen("Demand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Plays back break point envelope contours (levels, times, shapes) given by
 * demand ugens. The next values are called when the next node is reached.
 */
export class DemandEnvGen {
  private _calcRate!: Rate;
  private _level!: UGenInput;
  private _dur!: UGenInput;
  private _shape!: UGenInput;
  private _curve!: UGenInput;
  private _gate!: UGenInput;
  private _reset!: UGenInput;
  private _levelScale!: UGenInput;
  private _levelBias!: UGenInput;
  private _timeScale!: UGenInput;
  private _action!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DemandEnvGen {
    const b = new DemandEnvGen();
    b._calcRate = 'audio';
    b._level = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 0 };
    b._shape = { tag: 'constant', val: 1 };
    b._curve = { tag: 'constant', val: 0 };
    b._gate = { tag: 'constant', val: 1 };
    b._reset = { tag: 'constant', val: 1 };
    b._levelScale = { tag: 'constant', val: 1 };
    b._levelBias = { tag: 'constant', val: 0 };
    b._timeScale = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): DemandEnvGen {
    const b = new DemandEnvGen();
    b._calcRate = 'control';
    b._level = { tag: 'constant', val: 0 };
    b._dur = { tag: 'constant', val: 0 };
    b._shape = { tag: 'constant', val: 1 };
    b._curve = { tag: 'constant', val: 0 };
    b._gate = { tag: 'constant', val: 1 };
    b._reset = { tag: 'constant', val: 1 };
    b._levelScale = { tag: 'constant', val: 1 };
    b._levelBias = { tag: 'constant', val: 0 };
    b._timeScale = { tag: 'constant', val: 1 };
    b._action = { tag: 'constant', val: 0 };
    return b;
  }

  /** demand ugen (or other ugen) returning level values */
  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  /** demand ugen (or other ugen) returning time values */
  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  /**
   * demand ugen (or other ugen) returning shape number - the number given is the
   * shape number
   */
  shape(v: UGenInputLike): this {
    this._shape = toUGenInput(v);
    return this;
  }

  /**
   * demand ugen (or other ugen) returning curve values - if shape is 5, this is
   * the curve factor. The possible values are: 0 - flat segments, 1 - linear
   * segments, the default, 2 - natural exponential growth and decay. In this case,
   * the levels must all be nonzero and the have the same sign, 3 - sinusoidal S
   * shaped segments, 4 - sinusoidal segments shaped like the sides of a Welch
   * window, a Float - a curvature value for all segments, an Array of Floats -
   * curvature values for each segments.
   */
  curve(v: UGenInputLike): this {
    this._curve = toUGenInput(v);
    return this;
  }

  /**
   * control rate gate if gate is x >= 1, the ugen runs, if gate is 0 > x > 1, the
   * ugen is released at the next level (doneAction), if gate is x <= 0, the ugen
   * is sampled end held
   */
  gate(v: UGenInputLike): this {
    this._gate = toUGenInput(v);
    return this;
  }

  /**
   * if reset crosses from nonpositive to positive, the ugen is reset at the next
   * level. If it is > 1, it is reset immediately.
   */
  reset(v: UGenInputLike): this {
    this._reset = toUGenInput(v);
    return this;
  }

  /** demand ugen returning level scaling values */
  levelScale(v: UGenInputLike): this {
    this._levelScale = toUGenInput(v);
    return this;
  }

  /** demand ugen returning level offset values */
  levelBias(v: UGenInputLike): this {
    this._levelBias = toUGenInput(v);
    return this;
  }

  /** demand ugen returning time scaling values */
  timeScale(v: UGenInputLike): this {
    this._timeScale = toUGenInput(v);
    return this;
  }

  /** Default: NO-ACTION */
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
    inputs.push(this._level);
    inputs.push(this._dur);
    inputs.push(this._shape);
    inputs.push(this._curve);
    inputs.push(this._gate);
    inputs.push(this._reset);
    inputs.push(this._levelScale);
    inputs.push(this._levelBias);
    inputs.push(this._timeScale);
    inputs.push(this._action);
    const idx = def.addUgen("DemandEnvGen", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * dgeom cgen instead.
 */
export class Dgeom {
  private _calcRate!: Rate;
  private _length!: UGenInput;
  private _start!: UGenInput;
  private _grow!: UGenInput;

  private constructor() {}

  /** Default: positive infinity */
  length(v: UGenInputLike): this {
    this._length = toUGenInput(v);
    return this;
  }

  start(v: UGenInputLike): this {
    this._start = toUGenInput(v);
    return this;
  }

  grow(v: UGenInputLike): this {
    this._grow = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._length);
    inputs.push(this._start);
    inputs.push(this._grow);
    const idx = def.addUgen("Dgeom", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * dibrown cgen instead.
 */
export class Dibrown {
  private _calcRate!: Rate;
  private _length!: UGenInput;
  private _lo!: UGenInput;
  private _hi!: UGenInput;
  private _step!: UGenInput;

  private constructor() {}

  /** Default: positive infinity */
  length(v: UGenInputLike): this {
    this._length = toUGenInput(v);
    return this;
  }

  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  step(v: UGenInputLike): this {
    this._step = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._length);
    inputs.push(this._lo);
    inputs.push(this._hi);
    inputs.push(this._step);
    const idx = def.addUgen("Dibrown", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * diwhite cgen instead.
 */
export class Diwhite {
  private _calcRate!: Rate;
  private _length!: UGenInput;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Default: positive infinity */
  length(v: UGenInputLike): this {
    this._length = toUGenInput(v);
    return this;
  }

  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._length);
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("Diwhite", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

export class Donce {
  private _calcRate!: Rate;
  private _in!: UGenInput;

  private constructor() {}

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
    const idx = def.addUgen("Donce", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Print the value of an input demand ugen. The print-out is in the form: label:
 * value block offset: offset. WARNING: Printing values from the Server is
 * intensive for the CPU. Poll should be used for debugging purposes.
 */
export class Dpoll {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _trigId!: UGenInput;
  private _label!: UGenInput;
  private _run!: UGenInput;

  private constructor() {}

  /** demand ugen to poll values from */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
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

  /** a label string */
  label(v: UGenInputLike): this {
    this._label = toUGenInput(v);
    return this;
  }

  /** activation switch 0 or 1 (can be a demand ugen) */
  run(v: UGenInputLike): this {
    this._run = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._trigId);
    inputs.push(this._label);
    inputs.push(this._run);
    const idx = def.addUgen("Dpoll", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Demand rate random sequence generator. Generate a random ordering of an input
 * sequence.
 */
export class Drand {
  private _calcRate!: Rate;
  private _list!: UGenInput;
  private _numRepeats!: UGenInput;

  private constructor() {}

  /** array of values or other ugens */
  list(v: UGenInputLike): this {
    this._list = toUGenInput(v);
    return this;
  }

  /** number of repeats */
  numRepeats(v: UGenInputLike): this {
    this._numRepeats = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._list);
    inputs.push(this._numRepeats);
    const idx = def.addUgen("Drand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Demand rate sequence generator. Outputs a sequence of values, possibly
 * repeating multiple times. Use INF as a repeat val to create an endless loop.
 */
export class Dseq {
  private _calcRate!: Rate;
  private _list!: UGenInput;
  private _numRepeats!: UGenInput;

  private constructor() {}

  /** array of values or other ugens */
  list(v: UGenInputLike): this {
    this._list = toUGenInput(v);
    return this;
  }

  /** number of repeats */
  numRepeats(v: UGenInputLike): this {
    this._numRepeats = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._list);
    inputs.push(this._numRepeats);
    const idx = def.addUgen("Dseq", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Demand rate sequence generator. Generates a sequence of values like dseq,
 * except outputs only count total values, rather than repeating.
 */
export class Dser {
  private _calcRate!: Rate;
  private _list!: UGenInput;
  private _count!: UGenInput;

  private constructor() {}

  /** array of values or other ugens */
  list(v: UGenInputLike): this {
    this._list = toUGenInput(v);
    return this;
  }

  /** number of values to return */
  count(v: UGenInputLike): this {
    this._count = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._list);
    inputs.push(this._count);
    const idx = def.addUgen("Dser", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * dseries cgen instead.
 */
export class Dseries {
  private _calcRate!: Rate;
  private _length!: UGenInput;
  private _start!: UGenInput;
  private _step!: UGenInput;

  private constructor() {}

  /** Default: positive infinity. */
  length(v: UGenInputLike): this {
    this._length = toUGenInput(v);
    return this;
  }

  start(v: UGenInputLike): this {
    this._start = toUGenInput(v);
    return this;
  }

  step(v: UGenInputLike): this {
    this._step = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._length);
    inputs.push(this._start);
    inputs.push(this._step);
    const idx = def.addUgen("Dseries", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Demand rate random sequence generator. Shuffle a sequence once and then output
 * it one or more times.
 */
export class Dshuf {
  private _calcRate!: Rate;
  private _list!: UGenInput;
  private _numRepeats!: UGenInput;

  private constructor() {}

  /** array of values or other ugens */
  list(v: UGenInputLike): this {
    this._list = toUGenInput(v);
    return this;
  }

  /** number of repeats */
  numRepeats(v: UGenInputLike): this {
    this._numRepeats = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._list);
    inputs.push(this._numRepeats);
    const idx = def.addUgen("Dshuf", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Replicates input values n times on demand. Both inputs can be demand rate
 * ugens.
 */
export class Dstutter {
  private _calcRate!: Rate;
  private _numRepeats!: UGenInput;
  private _in!: UGenInput;

  private constructor() {}

  /** number of repeats (can be a demand ugen) */
  numRepeats(v: UGenInputLike): this {
    this._numRepeats = toUGenInput(v);
    return this;
  }

  /** input ugen */
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
    inputs.push(this._numRepeats);
    inputs.push(this._in);
    const idx = def.addUgen("Dstutter", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A demand rate switch. In difference to Dswitch1, Dswitch embeds all items of
 * an input demand ugen first before looking up the next index.
 */
export class Dswitch {
  private _calcRate!: Rate;
  private _list!: UGenInput;
  private _index!: UGenInput;

  private constructor() {}

  /** array of values or other ugens */
  list(v: UGenInputLike): this {
    this._list = toUGenInput(v);
    return this;
  }

  /** which of the inputs to return */
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
    inputs.push(this._list);
    inputs.push(this._index);
    const idx = def.addUgen("Dswitch", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * A demand rate switch that can be used to select one of multiple demand rate
 * inputs.
 */
export class Dswitch1 {
  private _calcRate!: Rate;
  private _list!: UGenInput;
  private _index!: UGenInput;

  private constructor() {}

  /** array of values or other ugens */
  list(v: UGenInputLike): this {
    this._list = toUGenInput(v);
    return this;
  }

  /** which of the inputs to return */
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
    inputs.push(this._list);
    inputs.push(this._index);
    const idx = def.addUgen("Dswitch1", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * duty cgen instead.
 */
export class Duty {
  private _calcRate!: Rate;
  private _dur!: UGenInput;
  private _reset!: UGenInput;
  private _action!: UGenInput;
  private _level!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Duty {
    const b = new Duty();
    b._calcRate = 'audio';
    b._dur = { tag: 'constant', val: 1 };
    b._reset = { tag: 'constant', val: 0 };
    b._action = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Duty {
    const b = new Duty();
    b._calcRate = 'control';
    b._dur = { tag: 'constant', val: 1 };
    b._reset = { tag: 'constant', val: 0 };
    b._action = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    return b;
  }

  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  reset(v: UGenInputLike): this {
    this._reset = toUGenInput(v);
    return this;
  }

  /** Default: NO-ACTION */
  action(v: UGenInputLike): this {
    this._action = toUGenInput(v);
    return this;
  }

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
    inputs.push(this._dur);
    inputs.push(this._reset);
    inputs.push(this._action);
    inputs.push(this._level);
    const idx = def.addUgen("Duty", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * dwhite cgen instead.
 */
export class Dwhite {
  private _calcRate!: Rate;
  private _length!: UGenInput;
  private _lo!: UGenInput;
  private _hi!: UGenInput;

  private constructor() {}

  /** Default: positive infinity */
  length(v: UGenInputLike): this {
    this._length = toUGenInput(v);
    return this;
  }

  lo(v: UGenInputLike): this {
    this._lo = toUGenInput(v);
    return this;
  }

  hi(v: UGenInputLike): this {
    this._hi = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._length);
    inputs.push(this._lo);
    inputs.push(this._hi);
    const idx = def.addUgen("Dwhite", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Demand rate random sequence generator. Generate a random ordering of the given
 * sequence without repeating any element until all elements have been returned.
 */
export class Dxrand {
  private _calcRate!: Rate;
  private _list!: UGenInput;
  private _numRepeats!: UGenInput;

  private constructor() {}

  /** array of values or other ugens */
  list(v: UGenInputLike): this {
    this._list = toUGenInput(v);
    return this;
  }

  /** number of repeats */
  numRepeats(v: UGenInputLike): this {
    this._numRepeats = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._list);
    inputs.push(this._numRepeats);
    const idx = def.addUgen("Dxrand", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * This ugen has been internalised for scserver compatibility. Please use the
 * tduty cgen instead.
 */
export class TDuty {
  private _calcRate!: Rate;
  private _dur!: UGenInput;
  private _reset!: UGenInput;
  private _action!: UGenInput;
  private _level!: UGenInput;
  private _gapFirst!: UGenInput;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): TDuty {
    const b = new TDuty();
    b._calcRate = 'audio';
    b._dur = { tag: 'constant', val: 1 };
    b._reset = { tag: 'constant', val: 0 };
    b._action = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    b._gapFirst = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): TDuty {
    const b = new TDuty();
    b._calcRate = 'control';
    b._dur = { tag: 'constant', val: 1 };
    b._reset = { tag: 'constant', val: 0 };
    b._action = { tag: 'constant', val: 0 };
    b._level = { tag: 'constant', val: 1 };
    b._gapFirst = { tag: 'constant', val: 0 };
    return b;
  }

  dur(v: UGenInputLike): this {
    this._dur = toUGenInput(v);
    return this;
  }

  reset(v: UGenInputLike): this {
    this._reset = toUGenInput(v);
    return this;
  }

  /** Default: NO-ACTION */
  action(v: UGenInputLike): this {
    this._action = toUGenInput(v);
    return this;
  }

  level(v: UGenInputLike): this {
    this._level = toUGenInput(v);
    return this;
  }

  gapFirst(v: UGenInputLike): this {
    this._gapFirst = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._dur);
    inputs.push(this._reset);
    inputs.push(this._action);
    inputs.push(this._level);
    inputs.push(this._gapFirst);
    const idx = def.addUgen("TDuty", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
