// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Toggles between two values when a key on the keyboard is up or down. Note that
 * this ugen does not prevent normal typing.
 */
export class KeyState {
  private _calcRate!: Rate;
  private _keycode!: UGenInput;
  private _minval!: UGenInput;
  private _maxval!: UGenInput;
  private _lag!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): KeyState {
    const b = new KeyState();
    b._calcRate = 'control';
    b._keycode = { tag: 'constant', val: 0 };
    b._minval = { tag: 'constant', val: 0 };
    b._maxval = { tag: 'constant', val: 1 };
    b._lag = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** The keycode value of the key to check. */
  keycode(v: UGenInputLike): this {
    this._keycode = toUGenInput(v);
    return this;
  }

  /** The value to output when the key is not pressed. */
  minval(v: UGenInputLike): this {
    this._minval = toUGenInput(v);
    return this;
  }

  /** The value to output when the key is pressed. */
  maxval(v: UGenInputLike): this {
    this._maxval = toUGenInput(v);
    return this;
  }

  /** lag factor */
  lag(v: UGenInputLike): this {
    this._lag = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._keycode);
    inputs.push(this._minval);
    inputs.push(this._maxval);
    inputs.push(this._lag);
    const idx = def.addUgen("KeyState", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** toggles between two values when the left mouse button is up or down */
export class MouseButton {
  private _calcRate!: Rate;
  private _up!: UGenInput;
  private _down!: UGenInput;
  private _lag!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): MouseButton {
    const b = new MouseButton();
    b._calcRate = 'control';
    b._up = { tag: 'constant', val: 0 };
    b._down = { tag: 'constant', val: 1 };
    b._lag = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** value when the key is not pressed */
  up(v: UGenInputLike): this {
    this._up = toUGenInput(v);
    return this;
  }

  /** value when the key is pressed */
  down(v: UGenInputLike): this {
    this._down = toUGenInput(v);
    return this;
  }

  /** lag factor */
  lag(v: UGenInputLike): this {
    this._lag = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._up);
    inputs.push(this._down);
    inputs.push(this._lag);
    const idx = def.addUgen("MouseButton", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** maps the current mouse X coordinate to a value between min and max */
export class MouseX {
  private _calcRate!: Rate;
  private _min!: UGenInput;
  private _max!: UGenInput;
  private _warp!: UGenInput;
  private _lag!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): MouseX {
    const b = new MouseX();
    b._calcRate = 'control';
    b._min = { tag: 'constant', val: 0 };
    b._max = { tag: 'constant', val: 1 };
    b._warp = { tag: 'constant', val: 0 };
    b._lag = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** minimum value (when mouse is at the left of the screen) */
  min(v: UGenInputLike): this {
    this._min = toUGenInput(v);
    return this;
  }

  /** maximum value (when mouse is at the right of the screen) */
  max(v: UGenInputLike): this {
    this._max = toUGenInput(v);
    return this;
  }

  /**
   * mapping curve - either LINEAR or EXPONENTIAL (LIN and EXP abbreviations are
   * allowed). Default is LINEAR.
   */
  warp(v: UGenInputLike): this {
    this._warp = toUGenInput(v);
    return this;
  }

  /** lag factor to dezipper cursor movement. */
  lag(v: UGenInputLike): this {
    this._lag = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._min);
    inputs.push(this._max);
    inputs.push(this._warp);
    inputs.push(this._lag);
    const idx = def.addUgen("MouseX", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/** maps the current mouse Y coordinate to a value between min and max */
export class MouseY {
  private _calcRate!: Rate;
  private _min!: UGenInput;
  private _max!: UGenInput;
  private _warp!: UGenInput;
  private _lag!: UGenInput;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): MouseY {
    const b = new MouseY();
    b._calcRate = 'control';
    b._min = { tag: 'constant', val: 0 };
    b._max = { tag: 'constant', val: 1 };
    b._warp = { tag: 'constant', val: 0 };
    b._lag = { tag: 'constant', val: 0.2 };
    return b;
  }

  /** minimum value (when mouse is at the top of the screen) */
  min(v: UGenInputLike): this {
    this._min = toUGenInput(v);
    return this;
  }

  /** maximum value (when mouse is at the bottom of the screen) */
  max(v: UGenInputLike): this {
    this._max = toUGenInput(v);
    return this;
  }

  /**
   * mapping curve - either LINEAR or EXPONENTIAL (LIN and EXP abbreviations are
   * allowed). Default is LINEAR
   */
  warp(v: UGenInputLike): this {
    this._warp = toUGenInput(v);
    return this;
  }

  /** lag factor to smooth out cursor movement. */
  lag(v: UGenInputLike): this {
    this._lag = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._min);
    inputs.push(this._max);
    inputs.push(this._warp);
    inputs.push(this._lag);
    const idx = def.addUgen("MouseY", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
