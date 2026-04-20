import {
  UGen,
  UGenOutput,
  type UGenInput,
  type Rate,
  Rate as R,
  type SynthDefContext,
  pushContext,
  popContext,
} from './ugen';
// ---------------------------------------------------------------------------
// Binary encoder
// ---------------------------------------------------------------------------

class ByteWriter {
  private buf: ArrayBuffer;
  private view: DataView;
  private pos = 0;

  constructor(size = 4096) {
    this.buf = new ArrayBuffer(size);
    this.view = new DataView(this.buf);
  }

  private grow(needed: number) {
    if (this.pos + needed <= this.buf.byteLength) return;
    let newSize = this.buf.byteLength;
    while (newSize < this.pos + needed) newSize *= 2;
    const newBuf = new ArrayBuffer(newSize);
    new Uint8Array(newBuf).set(new Uint8Array(this.buf));
    this.buf = newBuf;
    this.view = new DataView(this.buf);
  }

  int8(v: number) { this.grow(1); this.view.setInt8(this.pos, v); this.pos += 1; }
  uint8(v: number) { this.grow(1); this.view.setUint8(this.pos, v); this.pos += 1; }
  int16(v: number) { this.grow(2); this.view.setInt16(this.pos, v); this.pos += 2; }
  int32(v: number) { this.grow(4); this.view.setInt32(this.pos, v); this.pos += 4; }
  float32(v: number) { this.grow(4); this.view.setFloat32(this.pos, v); this.pos += 4; }

  pstring(s: string) {
    if (s.length > 255) throw new Error(`pstring too long: ${s.length}`);
    this.grow(1 + s.length);
    this.view.setUint8(this.pos, s.length);
    this.pos += 1;
    for (let i = 0; i < s.length; i++) {
      this.view.setUint8(this.pos + i, s.charCodeAt(i) & 0xff);
    }
    this.pos += s.length;
  }

  bytes(): Uint8Array { return new Uint8Array(this.buf.slice(0, this.pos)); }
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface ParamInfo {
  name: string;
  defaultValue: number;
  index: number;
}

interface InputSpec {
  ugenIndex: number;   // -1 for constant
  outputIndex: number;  // constant table index when ugenIndex === -1
}

// ---------------------------------------------------------------------------
// Public JSON type matching the SCgf binary structure
// ---------------------------------------------------------------------------

export interface SynthDefJson {
  name: string;
  constants: number[];
  parameters: {
    values: number[];
    names: { name: string; index: number }[];
  };
  ugens: {
    className: string;
    rate: number;
    numInputs: number;
    numOutputs: number;
    specialIndex: number;
    inputs: InputSpec[];
    outputs: { rate: number }[];
  }[];
  variants: never[];
}

// ---------------------------------------------------------------------------
// SynthDef
// ---------------------------------------------------------------------------

interface ControlGroup {
  ugen: UGen;
  outputCount: number;
}

export class SynthDef implements SynthDefContext {
  readonly name: string;
  private readonly nodes: UGen[] = [];
  private readonly params: ParamInfo[] = [];
  private constants: number[] = [];
  private constantMap = new Map<number, number>();

  /** All kr params funnel into one shared `Control` UGen, created lazily
   *  on the first `addControl(_, _, Control)` call. Matches sclang. */
  private controlGroup: ControlGroup | null = null;
  /** Same, for ar params via `AudioControl`. */
  private audioControlGroup: ControlGroup | null = null;
  /** Rate of the most recent `addControl` call — used to enforce that
   *  params of a given rate stay contiguous in the params table. */
  private lastParamRate: Rate | null = null;

  /**
   * Build a SynthDef by executing `fn` in a graph-building context.
   * All UGen / control() calls inside `fn` are captured into this definition.
   */
  constructor(name: string, fn: () => void) {
    if (!name) throw new Error('SynthDef name must not be empty');
    this.name = name;
    pushContext(this);
    try {
      fn();
    } finally {
      popContext();
    }
    this.collectConstants();
    this.validate();
  }

  // -- SynthDefContext implementation ---------------------------------------

  addUGen(ugen: UGen): void {
    ugen.synthIndex = this.nodes.length;
    this.nodes.push(ugen);
  }

  addControl(name: string, defaultValue: number, rate: Rate): UGenInput {
    if (this.params.some((p) => p.name === name)) {
      throw new Error(`Duplicate control name: "${name}"`);
    }

    // Each rate's params must be contiguous in the params table, because a
    // grouped Control / AudioControl's `specialIndex + outputSlot` indexes
    // back into that table. Interleaving is rejected; no real caller does it.
    const isAudio = rate === R.Audio;
    const alreadyHasThisRate = isAudio
      ? this.audioControlGroup !== null
      : this.controlGroup !== null;
    if (
      alreadyHasThisRate &&
      this.lastParamRate !== null &&
      (this.lastParamRate === R.Audio) !== isAudio
    ) {
      throw new Error(
        `addControl("${name}"): rate-interleaved controls are not supported — ` +
          `group all kr params, then all ar params`,
      );
    }

    const paramIndex = this.params.length;
    this.params.push({ name, defaultValue, index: paramIndex });
    this.lastParamRate = rate;

    const group = isAudio ? this.audioControlGroup : this.controlGroup;
    if (group === null) {
      const className = isAudio ? 'AudioControl' : 'Control';
      // Creating the UGen pushes it onto this SynthDef via addUGen() (through
      // the currentContext stack).
      const ugen = new UGen(className, rate, [], 1, paramIndex);
      const fresh: ControlGroup = { ugen, outputCount: 1 };
      if (isAudio) this.audioControlGroup = fresh;
      else this.controlGroup = fresh;
      return new UGenOutput(ugen, 0);
    }
    const slot = group.outputCount;
    group.ugen.numOutputs = slot + 1;
    group.outputCount = slot + 1;
    return new UGenOutput(group.ugen, slot);
  }

  // -- Internal helpers -----------------------------------------------------

  private collectConstants(): void {
    for (const ugen of this.nodes) {
      for (const input of ugen.inputs) {
        if (typeof input === 'number' && !this.constantMap.has(input)) {
          this.constantMap.set(input, this.constants.length);
          this.constants.push(input);
        }
      }
    }
  }

  private validate(): void {
    for (const ugen of this.nodes) {
      for (const input of ugen.inputs) {
        if (input instanceof UGen) {
          if (input.synthIndex < 0) {
            throw new Error(`${input.className} is not part of this SynthDef graph`);
          }
          if (input.synthIndex >= ugen.synthIndex) {
            throw new Error(
              `Forward reference: ${ugen.className}[${ugen.synthIndex}] ` +
              `references ${input.className}[${input.synthIndex}]`,
            );
          }
        } else if (input instanceof UGenOutput) {
          if (input.source.synthIndex < 0) {
            throw new Error(`${input.source.className} is not part of this SynthDef graph`);
          }
          if (input.source.synthIndex >= ugen.synthIndex) {
            throw new Error(
              `Forward reference: ${ugen.className}[${ugen.synthIndex}] ` +
              `references ${input.source.className}[${input.source.synthIndex}]`,
            );
          }
          if (input.outputIndex >= input.source.numOutputs) {
            throw new Error(
              `Output ${input.outputIndex} out of range for ` +
              `${input.source.className} (${input.source.numOutputs} outputs)`,
            );
          }
        } else if (typeof input !== 'number') {
          throw new Error(
            `Invalid input to ${ugen.className}: expected UGen, UGenOutput, or number`,
          );
        }
      }
    }
  }

  private resolveInput(input: UGenInput): InputSpec {
    if (typeof input === 'number') {
      return { ugenIndex: -1, outputIndex: this.constantMap.get(input)! };
    }
    if (input instanceof UGenOutput) {
      return { ugenIndex: input.source.synthIndex, outputIndex: input.outputIndex };
    }
    return { ugenIndex: input.synthIndex, outputIndex: 0 };
  }

  // -- Public API -----------------------------------------------------------

  /**
   * Encode as a complete SCgf version 2 binary file.
   * The returned Uint8Array can be written directly to a `.scsyndef` file
   * or sent to scsynth via `/d_recv`.
   */
  toBytes(): Uint8Array {
    const w = new ByteWriter();

    // ── File header ──
    w.int32(0x53436766); // "SCgf"
    w.int32(2);          // version 2
    w.int16(1);          // 1 synth definition

    // ── SynthDef name ──
    w.pstring(this.name);

    // ── Constants ──
    w.int32(this.constants.length);
    for (const c of this.constants) w.float32(c);

    // ── Parameters ──
    w.int32(this.params.length);
    for (const p of this.params) w.float32(p.defaultValue);

    // ── Parameter names ──
    w.int32(this.params.length);
    for (const p of this.params) {
      w.pstring(p.name);
      w.int32(p.index);
    }

    // ── UGens ──
    w.int32(this.nodes.length);
    for (const ugen of this.nodes) {
      w.pstring(ugen.className);
      w.int8(ugen.rate);
      w.int32(ugen.inputs.length);
      w.int32(ugen.numOutputs);
      w.int16(ugen.specialIndex);

      for (const input of ugen.inputs) {
        const spec = this.resolveInput(input);
        w.int32(spec.ugenIndex);
        w.int32(spec.outputIndex);
      }

      for (let i = 0; i < ugen.numOutputs; i++) {
        w.int8(ugen.rate);
      }
    }

    // ── Variants (none) ──
    w.int16(0);

    return w.bytes();
  }

  /**
   * JSON representation mirroring the SCgf binary structure.
   * Useful for debugging, inspection, and interop.
   */
  toJson(): SynthDefJson {
    return {
      name: this.name,
      constants: [...this.constants],
      parameters: {
        values: this.params.map((p) => p.defaultValue),
        names: this.params.map((p) => ({ name: p.name, index: p.index })),
      },
      ugens: this.nodes.map((ugen) => ({
        className: ugen.className,
        rate: ugen.rate,
        numInputs: ugen.inputs.length,
        numOutputs: ugen.numOutputs,
        specialIndex: ugen.specialIndex,
        inputs: ugen.inputs.map((input) => this.resolveInput(input)),
        outputs: Array.from({ length: ugen.numOutputs }, () => ({
          rate: ugen.rate,
        })),
      })),
      variants: [],
    };
  }
}

/**
 * Create a SynthDef by name and builder function.
 *
 * @example
 * ```ts
 * const def = synthDef('mySynth', () => {
 *   const freq = control('freq', 440);
 *   const sig = SinOsc.ar(freq);
 *   Out.ar(0, sig);
 * });
 *
 * const bytes = def.toBytes();  // Uint8Array — SCgf v2
 * const json  = def.toJson();   // structured JSON
 * ```
 */
export function synthDef(name: string, fn: () => void): SynthDef {
  return new SynthDef(name, fn);
}
