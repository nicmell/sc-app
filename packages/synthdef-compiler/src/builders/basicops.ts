// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * Multiply the input source by mul then add the add value. Equivalent to, but
 * more efficient than, (+ add (* mul in))
 */
export class MulAdd {
  private _calcRate!: Rate;
  private _in!: UGenInput;
  private _mul!: UGenInput;
  private _add!: UGenInput;

  private constructor() {}

  /** Build at ir rate (Rate::Scalar). */
  static ir(): MulAdd {
    const b = new MulAdd();
    b._calcRate = 'scalar';
    b._in = { tag: 'constant', val: 0 };
    b._mul = { tag: 'constant', val: 0 };
    b._add = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at ar rate (Rate::Audio). */
  static ar(): MulAdd {
    const b = new MulAdd();
    b._calcRate = 'audio';
    b._in = { tag: 'constant', val: 0 };
    b._mul = { tag: 'constant', val: 0 };
    b._add = { tag: 'constant', val: 0 };
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): MulAdd {
    const b = new MulAdd();
    b._calcRate = 'control';
    b._in = { tag: 'constant', val: 0 };
    b._mul = { tag: 'constant', val: 0 };
    b._add = { tag: 'constant', val: 0 };
    return b;
  }

  /** Input to modify */
  in(v: UGenInputLike): this {
    this._in = toUGenInput(v);
    return this;
  }

  /** Multiplier Value */
  mul(v: UGenInputLike): this {
    this._mul = toUGenInput(v);
    return this;
  }

  /** Addition Value */
  add(v: UGenInputLike): this {
    this._add = toUGenInput(v);
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._in);
    inputs.push(this._mul);
    inputs.push(this._add);
    const idx = def.addUgen("MulAdd", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}
