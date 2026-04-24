import { CompileError } from './error.js';
import { Rate, rateToI8, rateFromI8 } from './rate.js';
import { UGenInput, ugenIndex, outputIndex } from './ugen-input.js';

// ---------------------------------------------------------------------------
// Structured JSON representation — mirrors Rust `SynthDefJson` field-for-field
// (camelCase field names).
// ---------------------------------------------------------------------------

export interface ParamNameEntry {
  name: string;
  index: number;
}

export interface Parameters {
  values: number[];
  names: ParamNameEntry[];
}

/**
 * Wire-format input reference. `ugenIndex === -1` means the value is a
 * constant at `outputIndex` in the constants table.
 */
export interface InputSpec {
  ugenIndex: number;
  outputIndex: number;
}

export interface OutputSpec {
  rate: number;
}

export interface UGenJson {
  className: string;
  rate: number;
  numInputs: number;
  numOutputs: number;
  specialIndex: number;
  inputs: InputSpec[];
  outputs: OutputSpec[];
}

/**
 * JSON view of a compiled SynthDef. Shape matches the Rust `SynthDefJson`
 * (via `#[serde(rename_all = "camelCase")]`).
 */
export interface SynthDefJson {
  name: string;
  constants: number[];
  parameters: Parameters;
  ugens: UGenJson[];
  /** Always empty — the SCgf v2 format reserves a variants section, but we never emit variants. */
  variants: unknown[];
}

// ---------------------------------------------------------------------------
// Internal node representation
// ---------------------------------------------------------------------------

interface Node {
  className: string;
  rate: Rate;
  inputs: UGenInput[];
  numOutputs: number;
  specialIndex: number;
}

interface ParamInfo {
  name: string;
  defaultValue: number;
}

interface ControlGroup {
  nodeIndex: number;
  outputCount: number;
}

/**
 * A SynthDef being built. Add controls and UGens, then encode to SCgf v2
 * bytes with `toBytes()` or to a structured JSON form with `toJson()`.
 */
export class SynthDef {
  private _name: string;
  private nodes: Node[] = [];
  private params: ParamInfo[] = [];
  /** All kr parameters funnel into a single `Control` UGen. Lazy. */
  private controlGroup: ControlGroup | null = null;
  /** Same, for ar parameters via `AudioControl`. */
  private audioControlGroup: ControlGroup | null = null;
  /** Rate of the most recent addControl call — for contiguity enforcement. */
  private lastParamRate: Rate | null = null;

  constructor(name: string) {
    this._name = name;
  }

  name(): string {
    return this._name;
  }

  /** Calculation rate of a previously-added UGen node. */
  getNodeRate(nodeIndex: number): Rate {
    const node = this.nodes[nodeIndex];
    if (!node) throw new CompileError(`UGen index ${nodeIndex} out of range`);
    return node.rate;
  }

  /**
   * Add a named control (parameter). The returned `UGenInput` can be used
   * directly as an input to other UGens; it resolves to the right output
   * slot of the rate-grouped `Control` / `AudioControl` UGen.
   *
   * Matches sclang's convention: all kr params share a single `Control`
   * UGen (one output per param); ar params likewise share a single
   * `AudioControl` UGen.
   */
  addControl(name: string, defaultValue: number, rate: Rate): UGenInput {
    if (this.params.some((p) => p.name === name)) {
      throw new CompileError(`Duplicate control name: "${name}"`);
    }

    const isAudio = rate === 'audio';
    const alreadyHasThisRate = isAudio
      ? this.audioControlGroup !== null
      : this.controlGroup !== null;
    if (
      alreadyHasThisRate &&
      this.lastParamRate !== null &&
      (this.lastParamRate === 'audio') !== isAudio
    ) {
      throw new CompileError(
        `Duplicate control name: "${name}: rate-interleaved controls are not supported — group all kr params, then all ar params"`,
      );
    }

    const paramIndex = this.params.length;
    this.params.push({ name, defaultValue });
    this.lastParamRate = rate;

    if (isAudio) {
      return this.growGroup('audioControlGroup', 'AudioControl', 'audio', paramIndex);
    }
    return this.growGroup('controlGroup', 'Control', 'control', paramIndex);
  }

  private growGroup(
    groupField: 'controlGroup' | 'audioControlGroup',
    className: string,
    rate: Rate,
    paramIndex: number,
  ): UGenInput {
    const existing = this[groupField];
    if (existing) {
      const slot = existing.outputCount;
      existing.outputCount += 1;
      this.nodes[existing.nodeIndex].numOutputs = existing.outputCount;
      return { tag: 'ugenOutput', ugenIdx: existing.nodeIndex, outputIdx: slot };
    }
    const nodeIndex = this.nodes.length;
    this.nodes.push({
      className,
      rate,
      inputs: [],
      numOutputs: 1,
      specialIndex: paramIndex,
    });
    this[groupField] = { nodeIndex, outputCount: 1 };
    return { tag: 'ugenOutput', ugenIdx: nodeIndex, outputIdx: 0 };
  }

  /** Add a UGen node. Returns its index in the node list. */
  addUgen(
    className: string,
    rate: Rate,
    inputs: UGenInput[],
    numOutputs: number,
    specialIndex: number,
  ): number {
    const idx = this.nodes.length;
    this.nodes.push({
      className,
      rate,
      inputs: [...inputs],
      numOutputs,
      specialIndex,
    });
    return idx;
  }

  /** Encode the SynthDef as a complete SCgf version 2 binary file. */
  toBytes(): Uint8Array {
    if (this._name.length === 0) {
      throw new CompileError('SynthDef name must not be empty');
    }
    this.validate();

    const { constants, constantMap } = this.collectConstants();

    const w = new ByteWriter();
    w.i32(0x53436766); // "SCgf"
    w.i32(2); // version
    w.i16(1); // number of synth definitions
    w.pstring(this._name);

    // Constants
    w.i32(constants.length);
    for (const c of constants) w.f32(c);

    // Parameter defaults
    w.i32(this.params.length);
    for (const p of this.params) w.f32(p.defaultValue);

    // Parameter names
    w.i32(this.params.length);
    for (let i = 0; i < this.params.length; i++) {
      w.pstring(this.params[i].name);
      w.i32(i);
    }

    // UGens
    w.i32(this.nodes.length);
    for (const node of this.nodes) {
      w.pstring(node.className);
      w.i8(rateToI8(node.rate));
      w.i32(node.inputs.length);
      w.i32(node.numOutputs);
      w.i16(node.specialIndex);
      for (const input of node.inputs) {
        const spec = resolveInputSpec(input, constantMap);
        w.i32(spec.ugenIndex);
        w.i32(spec.outputIndex);
      }
      for (let i = 0; i < node.numOutputs; i++) {
        w.i8(rateToI8(node.rate));
      }
    }

    // Variants terminator
    w.i16(0);

    return w.finish();
  }

  /**
   * Structured JSON representation mirroring the SCgf binary layout.
   * Useful for inspection and debugging.
   */
  toJson(): SynthDefJson {
    if (this._name.length === 0) {
      throw new CompileError('SynthDef name must not be empty');
    }
    this.validate();

    const { constants, constantMap } = this.collectConstants();

    const ugens: UGenJson[] = this.nodes.map((n) => ({
      className: n.className,
      rate: rateToI8(n.rate),
      numInputs: n.inputs.length,
      numOutputs: n.numOutputs,
      specialIndex: n.specialIndex,
      inputs: n.inputs.map((i) => resolveInputSpec(i, constantMap)),
      outputs: Array.from({ length: n.numOutputs }, () => ({ rate: rateToI8(n.rate) })),
    }));

    return {
      name: this._name,
      constants: [...constants],
      parameters: {
        values: this.params.map((p) => p.defaultValue),
        names: this.params.map((p, i) => ({ name: p.name, index: i })),
      },
      ugens,
      variants: [],
    };
  }

  /** Reconstruct a `SynthDef` from its SCgf v2 binary form. */
  static fromBytes(bytes: Uint8Array): SynthDef {
    return SynthDef.fromJson(parseScgf(bytes));
  }

  /** Reconstruct a `SynthDef` from its JSON representation. */
  static fromJson(j: SynthDefJson): SynthDef {
    const def = new SynthDef(j.name);

    // The JSON's ugen list already contains Control/AudioControl nodes at
    // their exact positions, so we don't use addControl (which would push
    // another Control node). We rebuild params separately and append every
    // ugen — Control and otherwise — directly.
    for (const name of j.parameters.names) {
      const idx = name.index;
      const defVal = j.parameters.values[idx];
      if (defVal === undefined) {
        throw new CompileError(`Unknown UGen id: "${name.name}"`);
      }
      def.params.push({ name: name.name, defaultValue: defVal });
    }

    for (const u of j.ugens) {
      const rate = rateFromI8(u.rate);
      const inputs: UGenInput[] = u.inputs.map((i) => {
        if (i.ugenIndex < 0) {
          const cIdx = i.outputIndex;
          const c = j.constants[cIdx];
          if (c === undefined) {
            throw new CompileError(`UGen index ${cIdx} out of range`);
          }
          return { tag: 'constant', val: c };
        }
        return { tag: 'ugenOutput', ugenIdx: i.ugenIndex, outputIdx: i.outputIndex };
      });
      def.nodes.push({
        className: u.className,
        rate,
        inputs,
        numOutputs: u.numOutputs,
        specialIndex: u.specialIndex,
      });
    }

    return def;
  }

  private validate(): void {
    for (let idx = 0; idx < this.nodes.length; idx++) {
      const node = this.nodes[idx];
      for (const input of node.inputs) {
        const refIdx = ugenIndex(input);
        if (refIdx === null) continue;
        if (refIdx >= this.nodes.length) {
          throw new CompileError(`UGen index ${refIdx} out of range`);
        }
        if (refIdx >= idx) {
          const referenced = this.nodes[refIdx];
          throw new CompileError(
            `Forward reference: ${node.className}[${idx}] references ${referenced.className}[${refIdx}]`,
          );
        }
        const out = outputIndex(input);
        const referenced = this.nodes[refIdx];
        if (out >= referenced.numOutputs) {
          throw new CompileError(
            `Output ${out} out of range for ${referenced.className} (${referenced.numOutputs} outputs)`,
          );
        }
      }
    }
  }

  /**
   * Collect constants in first-seen order. Compared by bit pattern to
   * match `f32::to_bits` semantics around NaN / signed zero (keeps parity
   * with the Rust implementation and sclang's output).
   */
  private collectConstants(): { constants: number[]; constantMap: Map<number, number> } {
    const constants: number[] = [];
    const constantMap = new Map<number, number>();
    for (const node of this.nodes) {
      for (const input of node.inputs) {
        if (input.tag === 'constant') {
          const bits = f32Bits(input.val);
          if (!constantMap.has(bits)) {
            constantMap.set(bits, constants.length);
            constants.push(input.val);
          }
        }
      }
    }
    return { constants, constantMap };
  }
}

// ---------------------------------------------------------------------------
// f32 bit-pattern normalization
// ---------------------------------------------------------------------------

const SHARED_F32 = new Float32Array(1);
const SHARED_U32 = new Uint32Array(SHARED_F32.buffer);

/**
 * Round-trip a number through an f32 and return its 32-bit pattern. This
 * gives us:
 *   (a) dedup constants by bit-identical f32, matching
 *       Rust's `f32::to_bits` (so `+0.0` and `-0.0` are distinct).
 *   (b) collapse doubles that happen to map to the same f32 onto a single
 *       constants-table slot — parity with sclang's float-only pipeline.
 */
function f32Bits(v: number): number {
  SHARED_F32[0] = v;
  return SHARED_U32[0];
}

function resolveInputSpec(input: UGenInput, constantMap: Map<number, number>): InputSpec {
  switch (input.tag) {
    case 'constant': {
      const idx = constantMap.get(f32Bits(input.val));
      if (idx === undefined) throw new CompileError('constant not collected');
      return { ugenIndex: -1, outputIndex: idx };
    }
    case 'ugen':
      return { ugenIndex: input.val, outputIndex: 0 };
    case 'ugenOutput':
      return { ugenIndex: input.ugenIdx, outputIndex: input.outputIdx };
  }
}

// ---------------------------------------------------------------------------
// SCgf v2 reader
// ---------------------------------------------------------------------------

/**
 * Parse SCgf v2 binary bytes into the structured `SynthDefJson` shape.
 * Throws on bad magic, unsupported version, or a truncated buffer.
 */
export function parseScgf(bytes: Uint8Array): SynthDefJson {
  const r = new ByteReader(bytes);
  const magic = r.i32();
  if (magic !== 0x53436766) {
    throw new CompileError(`Invalid SCgf: bad magic: 0x${(magic >>> 0).toString(16)}`);
  }
  const version = r.i32();
  if (version !== 2) {
    throw new CompileError(`Invalid SCgf: unsupported version: ${version}`);
  }
  const nDefs = r.i16();
  if (nDefs !== 1) {
    throw new CompileError(`Invalid SCgf: expected 1 synthdef, got ${nDefs}`);
  }
  const name = r.pstring();

  const nconst = r.i32();
  const constants: number[] = [];
  for (let i = 0; i < nconst; i++) constants.push(r.f32());

  const nParamVals = r.i32();
  const values: number[] = [];
  for (let i = 0; i < nParamVals; i++) values.push(r.f32());

  const nParamNames = r.i32();
  const names: ParamNameEntry[] = [];
  for (let i = 0; i < nParamNames; i++) {
    const nm = r.pstring();
    const idx = r.i32();
    names.push({ name: nm, index: idx });
  }

  const nugens = r.i32();
  const ugens: UGenJson[] = [];
  for (let u = 0; u < nugens; u++) {
    const className = r.pstring();
    const rate = r.i8();
    const ninputs = r.i32();
    const nouts = r.i32();
    const specialIndex = r.i16();
    const inputs: InputSpec[] = [];
    for (let i = 0; i < ninputs; i++) {
      inputs.push({ ugenIndex: r.i32(), outputIndex: r.i32() });
    }
    const outputs: OutputSpec[] = [];
    for (let i = 0; i < nouts; i++) outputs.push({ rate: r.i8() });
    ugens.push({
      className,
      rate,
      numInputs: ninputs,
      numOutputs: nouts,
      specialIndex,
      inputs,
      outputs,
    });
  }

  // Trailing i16 variants terminator is read but ignored.
  return {
    name,
    constants,
    parameters: { values, names },
    ugens,
    variants: [],
  };
}

// ---------------------------------------------------------------------------
// Big-endian byte reader / writer
// ---------------------------------------------------------------------------

class ByteReader {
  private view: DataView;
  private pos = 0;

  constructor(private buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  private need(n: number): void {
    if (this.pos + n > this.buf.length) {
      throw new CompileError(
        `Invalid SCgf: truncated: need ${n} bytes at offset ${this.pos}`,
      );
    }
  }

  i8(): number {
    this.need(1);
    const v = this.view.getInt8(this.pos);
    this.pos += 1;
    return v;
  }

  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos, false);
    this.pos += 2;
    return v;
  }

  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos, false);
    this.pos += 4;
    return v;
  }

  f32(): number {
    this.need(4);
    const v = this.view.getFloat32(this.pos, false);
    this.pos += 4;
    return v;
  }

  pstring(): string {
    this.need(1);
    const len = this.view.getUint8(this.pos);
    this.pos += 1;
    this.need(len);
    let s = '';
    for (let i = 0; i < len; i++) {
      s += String.fromCharCode(this.view.getUint8(this.pos + i));
    }
    this.pos += len;
    return s;
  }
}

class ByteWriter {
  private chunks: number[] = [];

  i8(v: number): void {
    this.chunks.push(v & 0xff);
  }

  i16(v: number): void {
    this.chunks.push((v >> 8) & 0xff, v & 0xff);
  }

  i32(v: number): void {
    this.chunks.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  }

  f32(v: number): void {
    SHARED_F32[0] = v;
    const bits = SHARED_U32[0];
    this.chunks.push(
      (bits >>> 24) & 0xff,
      (bits >>> 16) & 0xff,
      (bits >>> 8) & 0xff,
      bits & 0xff,
    );
  }

  pstring(s: string): void {
    if (s.length > 255) {
      throw new CompileError(`pstring too long: ${s.length}`);
    }
    this.chunks.push(s.length);
    for (let i = 0; i < s.length; i++) {
      // Truncate to Latin-1 to match sclang's pstring encoding.
      this.chunks.push(s.charCodeAt(i) & 0xff);
    }
  }

  finish(): Uint8Array {
    return new Uint8Array(this.chunks);
  }
}
