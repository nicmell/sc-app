// @generated — DO NOT EDIT. Regenerate with scripts/generate_builders.mjs.
//
// Auto-generated builders — one class per bundled UGen.

import { Rate } from '../rate.js';
import { SynthDef } from '../synthdef.js';
import { UGenInput, UGenInputLike, toUGenInput } from '../ugen-input.js';

/**
 * stream audio in from disk file
 * 
 * Continuously play a longer soundfile from disk. This requires a buffer to be
 * preloaded with one buffer size of sound. If loop is set to 1, the soundfile
 * will loop.
 */
export class DiskIn {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _loop!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DiskIn {
    const b = new DiskIn();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._loop = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  /** id of buffer */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /** Soundfile will loop if 1 otherwise not. */
  loop(v: UGenInputLike): this {
    this._loop = toUGenInput(v);
    return this;
  }

  /** Number of channels in the incoming audio. */
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
    inputs.push(this._loop);
    const idx = def.addUgen("DiskIn", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * stream audio out to disk file
 * 
 * The output of DiskOut is the number of frames written to disk. Note that the
 * number of channels in the buffer and the channelsArray must be the same,
 * otherwise DiskOut will fail silently (and not write anything to your file).
 */
export class DiskOut {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _channelsArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): DiskOut {
    const b = new DiskOut();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /** the number of the buffer to write to (prepared with /b-write) */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /** the Array of channels to write to the file. */
  channelsArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._channelsArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bufnum);
    inputs.push(...this._channelsArray);
    const idx = def.addUgen("DiskOut", this._calcRate, inputs, 1, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Read a signal from a bus.
 * 
 * in:kr is functionally similar to in-feedback. That is it reads all data on the
 * bus whether it is from the current cycle or not. This allows for it to receive
 * data from later in the node order. in:ar reads only data from the current
 * cycle, and will zero data from earlier cycles (for use within that synth; the
 * data remains on the bus). Because of this and the fact that the various out
 * ugens mix their output with data from the current cycle but overwrite data
 * from an earlier cycle it may be necessary to use a private control bus when
 * this type of feedback is desired.
 */
export class In {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): In {
    const b = new In();
    b._calcRate = 'audio';
    b._bus = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): In {
    const b = new In();
    b._calcRate = 'control';
    b._bus = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  /** the index of the bus to read in from */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /**
   * the number of channels (i.e. adjacent buses) to read in. The default is 1. You
   * cannot modulate this number by assigning it to an argument in a SynthDef.
   */
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
    inputs.push(this._bus);
    const idx = def.addUgen("In", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * read signal from a bus with a current or one cycle old timestamp
 * 
 * When the various output ugens (out, offsetOut, x-out) write data to a bus,
 * they mix it with any data from the current cycle, but overwrite any data from
 * the previous cycle. (replace-out overwrites all data regardless.) Thus
 * depending on node order and what synths are writing to thep bus, the data on a
 * given bus may be from the current cycle or be one cycle old at the time of
 * reading. in:ar checks the timestamp of any data it reads in and zeros any data
 * from the previous cycle (for use within that node; the data remains on the
 * bus). This is fine for audio data, as it avoids feedback, but for control data
 * it is useful to be able to read data from any place in the node order. For
 * this reason in:kr also reads data that is older than the current cycle. In
 * some cases we might also want to read audio from a node later in the current
 * node order. This is the purpose of InFeedback. The delay introduced by this is
 * one block size, which equals about 0.0014 sec at the default block size and
 * sample rate. (See the resonator example below to see the implications of
 * this.) The variably mixing and overwriting behaviour of the output ugens can
 * make order of execution crucial. (No pun intended.) For example with a node
 * order like the following the InFeedback ugen in Synth 2 will only receive data
 * from Synth 1 (-> = write out; <- = read in): Synth 1 -> busA This synth
 * overwrites the output of Synth3 before it reaches Synth 2 Synth 2 (with
 * InFeedback) <- busA Synth 3 -> busA If Synth 1 were moved after Synth 2 then
 * Synth 2's InFeedback would receive a mix of the output from Synth 1 and Synth
 * 3. This would also be true if Synth 2 came after Synth1 and Synth 3. In both
 * cases data from Synth 1 and Synth 3 would have the same time stamp (either
 * current or from the previous cycle), so nothing would be overwritten. Because
 * of this it is often useful to allocate a separate bus for feedback. With the
 * following arrangement Synth 2 will receive data from Synth3 regardless of
 * Synth 1's position in the node order. Synth 1 -> busA Synth 2 (with
 * InFeedback) <- busB Synth 3 -> busB + busA
 */
export class InFeedback {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): InFeedback {
    const b = new InFeedback();
    b._calcRate = 'audio';
    b._bus = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  /** the index of the bus to read in from. */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /**
   * the number of channels (i.e. adjacent buses) to read in. The default is 1. You
   * cannot modulate this number by assigning it to an argument in a SynthDef.
   */
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
    inputs.push(this._bus);
    const idx = def.addUgen("InFeedback", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * generates a trigger any time the bus is set
 * 
 * Any time the bus is 'touched' ie. has its value set (using \"/c_set\" etc.), a
 * single impulse trigger will be generated. Its amplitude is the value that the
 * bus was set to.
 */
export class InTrig {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): InTrig {
    const b = new InTrig();
    b._calcRate = 'control';
    b._bus = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  /** the index of the bus to read in from. */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /**
   * the number of channels (i.e. adjacent buses) to read in. The default is 1. You
   * cannot modulate this number by assigning it to an argument in a SynthDef.
   */
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
    inputs.push(this._bus);
    const idx = def.addUgen("InTrig", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Read a control signal from a bus with a lag.
 * 
 * Please document me
 */
export class LagIn {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _lag!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): LagIn {
    const b = new LagIn();
    b._calcRate = 'control';
    b._bus = { tag: 'constant', val: 0 };
    b._lag = { tag: 'constant', val: 0.1 };
    b._numChannels = 1;
    return b;
  }

  /** the index of the bus to read in from */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /** lag factor */
  lag(v: UGenInputLike): this {
    this._lag = toUGenInput(v);
    return this;
  }

  /** the number of channels (i.e. adjacent buses) to read in. Not modulatable. */
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
    inputs.push(this._bus);
    inputs.push(this._lag);
    const idx = def.addUgen("LagIn", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * defines buses that are local to the enclosing synth. These are like the global
 * buses, but are more convenient if you want to implement a self contained
 * effect that uses a feedback processing loop. There can only be one audio rate
 * and one control rate local-in per SynthDef. The audio can be written to the
 * bus using local-out.
 */
export class LocalIn {
  private _calcRate!: Rate;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LocalIn {
    const b = new LocalIn();
    b._calcRate = 'audio';
    b._numChannels = 1;
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LocalIn {
    const b = new LocalIn();
    b._calcRate = 'control';
    b._numChannels = 1;
    return b;
  }

  /**
   * the number of channels (i.e. adjacent buses) to read in. The default is 1. You
   * cannot modulate this argument.
   */
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
    const idx = def.addUgen("LocalIn", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * write to buses local to a synth
 * 
 * local-out writes to buses that are local to the enclosing synth. The buses
 * should have been defined by a local-in ugen. The channelsArray must be the
 * same number of channels as were declared in the LocalIn. These are like the
 * global buses, but are more convenient if you want to implement a self
 * contained effect that uses a feedback processing loop.
 */
export class LocalOut {
  private _calcRate!: Rate;
  private _channelsArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): LocalOut {
    const b = new LocalOut();
    b._calcRate = 'audio';
    b._channelsArray = [];
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): LocalOut {
    const b = new LocalOut();
    b._calcRate = 'control';
    b._channelsArray = [];
    return b;
  }

  /**
   * an Array of channels or single output to write out. You cannot change the size
   * of this once a SynthDef has been built.
   */
  channelsArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._channelsArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(...this._channelsArray);
    const idx = def.addUgen("LocalOut", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * write signal to a bus with sample accurate timing
 * 
 * Output signal to a bus, the sample offset within the bus is kept exactly; i.e.
 * if the synth is scheduled to be started part way through a control cycle,
 * offset-out will maintain the correct offset by buffering the output and
 * delaying it until the exact time that the synth was scheduled for. This ugen
 * is used where sample accurate output is needed.
 */
export class OffsetOut {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _channelsArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): OffsetOut {
    const b = new OffsetOut();
    b._calcRate = 'audio';
    b._bus = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /**
   * the index of the buss to write to. The lowest index numbers are written to the
   * audio hardware.
   */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /**
   * a list of signals or single output to write out. You cannot change the size of
   * this once a synth has been defined.
   */
  channelsArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._channelsArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bus);
    inputs.push(...this._channelsArray);
    const idx = def.addUgen("OffsetOut", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * write a signal to a bus, adding to previous contents.
 * 
 * write a signal to a bus, adding to any existing contents N.B. Out is subject
 * to control rate jitter. Where sample accurate output is needed, use OffsetOut.
 * When using an array of bus indexes, the channel array will just be copied to
 * each bus index in the array. So (out:ar [bus1 bus2] channels-array) will be
 * the same as (+ (out:ar bus1 channelsArray) (out:ar bus2 channelsArray)).
 */
export class Out {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _channelsArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): Out {
    const b = new Out();
    b._calcRate = 'audio';
    b._bus = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): Out {
    const b = new Out();
    b._calcRate = 'control';
    b._bus = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /**
   * the index of the buss to write to. The lowest index numbers are written to the
   * audio hardware.
   */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /**
   * a list of signals or single output to write out. You cannot change the size of
   * this once a synth has been defined.
   */
  channelsArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._channelsArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bus);
    inputs.push(...this._channelsArray);
    const idx = def.addUgen("Out", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Send signal to a bus, overwriting previous contents.
 * 
 * Out adds its output to a given bus, making it available to all nodes later in
 * the node tree (See Synth and Order-of-execution for more information).
 * ReplaceOut overwrites those contents. This can make it useful for processing.
 */
export class ReplaceOut {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _channelsArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): ReplaceOut {
    const b = new ReplaceOut();
    b._calcRate = 'audio';
    b._bus = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): ReplaceOut {
    const b = new ReplaceOut();
    b._calcRate = 'control';
    b._bus = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /**
   * the index of the buss to write to. The lowest index numbers are written to the
   * audio hardware.
   */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /**
   * a list of signals or single output to write out. You cannot change the size of
   * this once a synth has been defined.
   */
  channelsArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._channelsArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bus);
    inputs.push(...this._channelsArray);
    const idx = def.addUgen("ReplaceOut", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * read from a shared control bus (internal dsp only)
 * 
 * Reads from a control bus shared between the internal server and the SC client.
 * Control rate only. Writing to a shared control bus from the client is
 * synchronous. When not using the internal server use node arguments or the set
 * method of Bus (or /c_set in messaging style).
 */
export class SharedIn {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): SharedIn {
    const b = new SharedIn();
    b._calcRate = 'control';
    b._bus = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  /** the index of the shared control bus to read from */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /**
   * the number of channels (i.e. adjacent buses) to read in. The default is 1. You
   * cannot modulate this number by assigning it to an argument in a SynthDef.
   */
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
    inputs.push(this._bus);
    const idx = def.addUgen("SharedIn", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * Reads from a control bus shared between the internal server and the SC client.
 * Control rate only. Reading from a shared control bus on the client is
 * synchronous.
 */
export class SharedOut {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _channelsArray!: UGenInput[];

  private constructor() {}

  /** Build at kr rate (Rate::Control). */
  static kr(): SharedOut {
    const b = new SharedOut();
    b._calcRate = 'control';
    b._bus = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /** the index of the shared control bus to read from */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /**
   * an Array of channels or single output to write out. You cannot change the size
   * of this once a SynthDef has been built.
   */
  channelsArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._channelsArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bus);
    inputs.push(...this._channelsArray);
    const idx = def.addUgen("SharedOut", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * stream in audio from a file (with variable rate)
 * 
 * Continuously play a longer soundfile from disk. This requires a buffer to be
 * preloaded with one buffer size of sound.
 */
export class VDiskIn {
  private _calcRate!: Rate;
  private _bufnum!: UGenInput;
  private _rate!: UGenInput;
  private _loop!: UGenInput;
  private _sendId!: UGenInput;
  private _numChannels!: number;

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): VDiskIn {
    const b = new VDiskIn();
    b._calcRate = 'audio';
    b._bufnum = { tag: 'constant', val: 0 };
    b._rate = { tag: 'constant', val: 1 };
    b._loop = { tag: 'constant', val: 0 };
    b._sendId = { tag: 'constant', val: 0 };
    b._numChannels = 1;
    return b;
  }

  /** id of buffer */
  bufnum(v: UGenInputLike): this {
    this._bufnum = toUGenInput(v);
    return this;
  }

  /**
   * controls the rate of playback. Values below 4 are probably fine, but the
   * higher the value, the more disk activity there is, and the more likelihood
   * there will be a problem.
   */
  rate(v: UGenInputLike): this {
    this._rate = toUGenInput(v);
    return this;
  }

  /** Soundfile will loop if 1 otherwise not. */
  loop(v: UGenInputLike): this {
    this._loop = toUGenInput(v);
    return this;
  }

  /**
   * send an osc message with this id and the file position each time the buffer is
   * reloaded: ['/diskin', nodeID, sendID, frame]
   */
  sendId(v: UGenInputLike): this {
    this._sendId = toUGenInput(v);
    return this;
  }

  /** Number of channels in the audio */
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
    inputs.push(this._rate);
    inputs.push(this._loop);
    inputs.push(this._sendId);
    const idx = def.addUgen("VDiskIn", this._calcRate, inputs, this._numChannels, 0);
    return { tag: 'ugen', val: idx };
  }
}

/**
 * write signal to a bus, crossfading with the existing content
 * 
 * xfade is a level for the crossfade between what is on the bus and what you are
 * sending. The algorithm is equivalent to this: bus_signal = (input_signal *
 * xfade) + (bus_signal * (1 - xfade));
 */
export class XOut {
  private _calcRate!: Rate;
  private _bus!: UGenInput;
  private _xfade!: UGenInput;
  private _channelsArray!: UGenInput[];

  private constructor() {}

  /** Build at ar rate (Rate::Audio). */
  static ar(): XOut {
    const b = new XOut();
    b._calcRate = 'audio';
    b._bus = { tag: 'constant', val: 0 };
    b._xfade = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /** Build at kr rate (Rate::Control). */
  static kr(): XOut {
    const b = new XOut();
    b._calcRate = 'control';
    b._bus = { tag: 'constant', val: 0 };
    b._xfade = { tag: 'constant', val: 0 };
    b._channelsArray = [];
    return b;
  }

  /**
   * the index, or array of indexes, of buses to write to. The lowest index numbers
   * are written to the audio hardware.
   */
  bus(v: UGenInputLike): this {
    this._bus = toUGenInput(v);
    return this;
  }

  /** crossfade level. */
  xfade(v: UGenInputLike): this {
    this._xfade = toUGenInput(v);
    return this;
  }

  /**
   * an Array of channels or single output to write out. You cannot change the size
   * of this once a SynthDef has been built.
   */
  channelsArray(iter: Iterable<UGenInputLike>): this {
    const arr: UGenInput[] = [];
    for (const v of iter) arr.push(toUGenInput(v));
    this._channelsArray = arr;
    return this;
  }

  /**
   * Materialise this UGen into `def`'s node list.
   * Returns a handle usable as input to other UGens.
   */
  build(def: SynthDef): UGenInput {
    const inputs: UGenInput[] = [];
    inputs.push(this._bus);
    inputs.push(this._xfade);
    inputs.push(...this._channelsArray);
    const idx = def.addUgen("XOut", this._calcRate, inputs, 0, 0);
    return { tag: 'ugen', val: idx };
  }
}
