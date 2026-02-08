import OSC from 'osc-js';

export function createStatusMessage() {
  return new OSC.Message('/status');
}

export function createSynthMessage(
  synthName: string = 'default',
  nodeId: number = 1000,
  addAction: number = 0,
  targetId: number = 0,
  params: Record<string, number> = { freq: 440, amp: 0.2 }
) {
  const msg = new OSC.Message('/s_new', synthName, nodeId, addAction, targetId);
  for (const [key, value] of Object.entries(params)) {
    msg.add(key);
    msg.add(value);
  }
  return msg;
}

export function createFreeNodeMessage(nodeId: number) {
  return new OSC.Message('/n_free', nodeId);
}

/**
 * Build a /d_recv message containing a compiled SynthDef binary.
 * The SynthDef defines a simple sine oscillator:
 *
 *   SynthDef(\sine, { |freq=440, amp=0.2|
 *       Out.ar(0, SinOsc.ar(freq, 0) * amp)
 *   })
 *
 * UGen graph:
 *   0: Control.kr       -> 2 outputs (freq, amp)
 *   1: SinOsc.ar(freq, 0)
 *   2: BinaryOpUGen.ar  -> SinOsc * amp
 *   3: Out.ar(0, signal)
 */
export function createDefRecvMessage() {
  const bytes = buildSineSynthDef();
  // osc-js handles Uint8Array as blob ('b') at runtime,
  // but the library's types incorrectly declare Blob instead of Uint8Array
  return new OSC.Message('/d_recv', bytes as unknown as Blob);
}

function buildSineSynthDef(): Uint8Array {
  const buf = new ArrayBuffer(256);
  const view = new DataView(buf);
  let offset = 0;

  function writeInt32(val: number) {
    view.setInt32(offset, val);
    offset += 4;
  }
  function writeInt16(val: number) {
    view.setInt16(offset, val);
    offset += 2;
  }
  function writeInt8(val: number) {
    view.setUint8(offset, val);
    offset += 1;
  }
  function writeFloat32(val: number) {
    view.setFloat32(offset, val);
    offset += 4;
  }
  function writePstr(str: string) {
    writeInt8(str.length);
    for (let i = 0; i < str.length; i++) {
      writeInt8(str.charCodeAt(i));
    }
  }

  // --- File header ---
  // Magic: "SCgf"
  writeInt8(0x53); writeInt8(0x43); writeInt8(0x67); writeInt8(0x66);
  writeInt32(2);   // version
  writeInt16(1);   // number of synth definitions

  // --- SynthDef "sine" ---
  writePstr('sine');

  // Constants: [0.0] (used for SinOsc phase and Out bus)
  writeInt32(1);
  writeFloat32(0.0);

  // Parameters: freq=440.0, amp=0.2
  writeInt32(2);
  writeFloat32(440.0);
  writeFloat32(0.2);

  // Parameter names
  writeInt32(2);
  writePstr('freq'); writeInt32(0);
  writePstr('amp');  writeInt32(1);

  // UGens (4 total)
  writeInt32(4);

  // UGen 0: Control.kr — exposes parameters as outputs
  writePstr('Control');
  writeInt8(1);      // rate: control
  writeInt32(0);     // num inputs
  writeInt32(2);     // num outputs
  writeInt16(0);     // special index
  writeInt8(1);      // output 0 rate: control (freq)
  writeInt8(1);      // output 1 rate: control (amp)

  // UGen 1: SinOsc.ar(freq, phase=0)
  writePstr('SinOsc');
  writeInt8(2);      // rate: audio
  writeInt32(2);     // num inputs
  writeInt32(1);     // num outputs
  writeInt16(0);     // special index
  writeInt32(0);     // input 0: UGen 0 (Control)
  writeInt32(0);     // input 0: output 0 (freq)
  writeInt32(-1);    // input 1: constant
  writeInt32(0);     // input 1: constant index 0 (0.0 = phase)
  writeInt8(2);      // output rate: audio

  // UGen 2: BinaryOpUGen.ar — SinOsc * amp
  writePstr('BinaryOpUGen');
  writeInt8(2);      // rate: audio
  writeInt32(2);     // num inputs
  writeInt32(1);     // num outputs
  writeInt16(2);     // special index: 2 = multiply
  writeInt32(1);     // input 0: UGen 1 (SinOsc)
  writeInt32(0);     // input 0: output 0
  writeInt32(0);     // input 1: UGen 0 (Control)
  writeInt32(1);     // input 1: output 1 (amp)
  writeInt8(2);      // output rate: audio

  // UGen 3: Out.ar(bus=0, signal)
  writePstr('Out');
  writeInt8(2);      // rate: audio
  writeInt32(2);     // num inputs
  writeInt32(0);     // num outputs
  writeInt16(0);     // special index
  writeInt32(-1);    // input 0: constant
  writeInt32(0);     // input 0: constant index 0 (0.0 = bus 0)
  writeInt32(2);     // input 1: UGen 2 (BinaryOpUGen)
  writeInt32(0);     // input 1: output 0
  // no output rates

  // Variants
  writeInt16(0);

  return new Uint8Array(buf, 0, offset);
}
