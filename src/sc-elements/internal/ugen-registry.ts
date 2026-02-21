export interface UGenRegistryEntry {
  inputs: string[];
  numOutputs: number;
}

export const UGEN_REGISTRY: Record<string, UGenRegistryEntry> = {
  // Oscillators
  SinOsc: {inputs: ['freq', 'phase'], numOutputs: 1},
  Saw: {inputs: ['freq'], numOutputs: 1},
  Pulse: {inputs: ['freq', 'width'], numOutputs: 1},
  LFSaw: {inputs: ['freq', 'iphase'], numOutputs: 1},
  LFPulse: {inputs: ['freq', 'iphase', 'width'], numOutputs: 1},
  LFTri: {inputs: ['freq', 'iphase'], numOutputs: 1},
  Impulse: {inputs: ['freq', 'phase'], numOutputs: 1},
  VarSaw: {inputs: ['freq', 'iphase', 'width'], numOutputs: 1},
  SyncSaw: {inputs: ['syncFreq', 'sawFreq'], numOutputs: 1},

  // Noise
  WhiteNoise: {inputs: [], numOutputs: 1},
  PinkNoise: {inputs: [], numOutputs: 1},
  BrownNoise: {inputs: [], numOutputs: 1},
  ClipNoise: {inputs: [], numOutputs: 1},
  LFNoise0: {inputs: ['freq'], numOutputs: 1},
  LFNoise1: {inputs: ['freq'], numOutputs: 1},
  LFNoise2: {inputs: ['freq'], numOutputs: 1},
  Dust: {inputs: ['density'], numOutputs: 1},
  Dust2: {inputs: ['density'], numOutputs: 1},

  // Filters
  LPF: {inputs: ['in', 'freq'], numOutputs: 1},
  HPF: {inputs: ['in', 'freq'], numOutputs: 1},
  BPF: {inputs: ['in', 'freq', 'rq'], numOutputs: 1},
  BRF: {inputs: ['in', 'freq', 'rq'], numOutputs: 1},
  RLPF: {inputs: ['in', 'freq', 'rq'], numOutputs: 1},
  RHPF: {inputs: ['in', 'freq', 'rq'], numOutputs: 1},
  MoogFF: {inputs: ['in', 'freq', 'gain', 'reset'], numOutputs: 1},

  // Envelopes / Lines
  Line: {inputs: ['start', 'end', 'dur', 'doneAction'], numOutputs: 1},
  XLine: {inputs: ['start', 'end', 'dur', 'doneAction'], numOutputs: 1},
  Linen: {inputs: ['gate', 'attackTime', 'susLevel', 'releaseTime', 'doneAction'], numOutputs: 1},

  // I/O
  Out: {inputs: ['bus', 'in'], numOutputs: 0},
  ReplaceOut: {inputs: ['bus', 'in'], numOutputs: 0},
  OffsetOut: {inputs: ['bus', 'in'], numOutputs: 0},
  In: {inputs: ['bus'], numOutputs: 1},
  InFeedback: {inputs: ['bus'], numOutputs: 1},
  LocalIn: {inputs: ['bus'], numOutputs: 1},
  LocalOut: {inputs: ['bus', 'in'], numOutputs: 0},

  // Panning
  Pan2: {inputs: ['in', 'pos', 'level'], numOutputs: 2},
  Balance2: {inputs: ['left', 'right', 'pos', 'level'], numOutputs: 2},

  // Delays
  DelayN: {inputs: ['in', 'maxDelayTime', 'delayTime'], numOutputs: 1},
  DelayL: {inputs: ['in', 'maxDelayTime', 'delayTime'], numOutputs: 1},
  DelayC: {inputs: ['in', 'maxDelayTime', 'delayTime'], numOutputs: 1},
  CombN: {inputs: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  CombL: {inputs: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  CombC: {inputs: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  AllpassN: {inputs: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  AllpassL: {inputs: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  AllpassC: {inputs: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},

  // Dynamics / Amplitude
  Decay: {inputs: ['in', 'decayTime'], numOutputs: 1},
  Decay2: {inputs: ['in', 'attackTime', 'decayTime'], numOutputs: 1},
  Integrator: {inputs: ['in', 'coef'], numOutputs: 1},
  Lag: {inputs: ['in', 'lagTime'], numOutputs: 1},
  Lag2: {inputs: ['in', 'lagTime'], numOutputs: 1},
  Lag3: {inputs: ['in', 'lagTime'], numOutputs: 1},

  // Effects
  FreeVerb: {inputs: ['in', 'mix', 'room', 'damp'], numOutputs: 1},
  FreeVerb2: {inputs: ['in', 'in2', 'mix', 'room', 'damp'], numOutputs: 2},

  // Triggers
  Trig: {inputs: ['in', 'dur'], numOutputs: 1},
  Trig1: {inputs: ['in', 'dur'], numOutputs: 1},
  TDelay: {inputs: ['trigger', 'dur'], numOutputs: 1},

  // Math / Utility
  Clip: {inputs: ['in', 'lo', 'hi'], numOutputs: 1},
  Wrap: {inputs: ['in', 'lo', 'hi'], numOutputs: 1},
  Fold: {inputs: ['in', 'lo', 'hi'], numOutputs: 1},
  LinLin: {inputs: ['in', 'srclo', 'srchi', 'dstlo', 'dsthi'], numOutputs: 1},
  DC: {inputs: ['in'], numOutputs: 1},

  // Done actions
  FreeSelf: {inputs: ['in'], numOutputs: 1},
  PauseSelf: {inputs: ['in'], numOutputs: 1},

  // Operators
  BinaryOpUGen: {inputs: ['a', 'b'], numOutputs: 1},
  UnaryOpUGen: {inputs: ['in'], numOutputs: 1},
  MulAdd: {inputs: ['in', 'mul', 'add'], numOutputs: 1},
};
