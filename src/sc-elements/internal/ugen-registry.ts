export interface UGenRegistryEntry {
  params: string[];
  numOutputs: number;
}

export const UGEN_REGISTRY: Record<string, UGenRegistryEntry> = {
  // Oscillators
  SinOsc: {params: ['freq', 'phase'], numOutputs: 1},
  Saw: {params: ['freq'], numOutputs: 1},
  Pulse: {params: ['freq', 'width'], numOutputs: 1},
  LFSaw: {params: ['freq', 'iphase'], numOutputs: 1},
  LFPulse: {params: ['freq', 'iphase', 'width'], numOutputs: 1},
  LFTri: {params: ['freq', 'iphase'], numOutputs: 1},
  Impulse: {params: ['freq', 'phase'], numOutputs: 1},
  VarSaw: {params: ['freq', 'iphase', 'width'], numOutputs: 1},
  SyncSaw: {params: ['syncFreq', 'sawFreq'], numOutputs: 1},

  // Noise
  WhiteNoise: {params: [], numOutputs: 1},
  PinkNoise: {params: [], numOutputs: 1},
  BrownNoise: {params: [], numOutputs: 1},
  ClipNoise: {params: [], numOutputs: 1},
  LFNoise0: {params: ['freq'], numOutputs: 1},
  LFNoise1: {params: ['freq'], numOutputs: 1},
  LFNoise2: {params: ['freq'], numOutputs: 1},
  Dust: {params: ['density'], numOutputs: 1},
  Dust2: {params: ['density'], numOutputs: 1},

  // Filters
  LPF: {params: ['in', 'freq'], numOutputs: 1},
  HPF: {params: ['in', 'freq'], numOutputs: 1},
  BPF: {params: ['in', 'freq', 'rq'], numOutputs: 1},
  BRF: {params: ['in', 'freq', 'rq'], numOutputs: 1},
  RLPF: {params: ['in', 'freq', 'rq'], numOutputs: 1},
  RHPF: {params: ['in', 'freq', 'rq'], numOutputs: 1},
  MoogFF: {params: ['in', 'freq', 'gain', 'reset'], numOutputs: 1},

  // Envelopes / Lines
  Line: {params: ['start', 'end', 'dur', 'doneAction'], numOutputs: 1},
  XLine: {params: ['start', 'end', 'dur', 'doneAction'], numOutputs: 1},
  Linen: {params: ['gate', 'attackTime', 'susLevel', 'releaseTime', 'doneAction'], numOutputs: 1},

  // I/O
  Out: {params: ['bus', 'in'], numOutputs: 0},
  ReplaceOut: {params: ['bus', 'in'], numOutputs: 0},
  OffsetOut: {params: ['bus', 'in'], numOutputs: 0},
  In: {params: ['bus'], numOutputs: 1},
  InFeedback: {params: ['bus'], numOutputs: 1},
  LocalIn: {params: ['bus'], numOutputs: 1},
  LocalOut: {params: ['bus', 'in'], numOutputs: 0},

  // Panning
  Pan2: {params: ['in', 'pos', 'level'], numOutputs: 2},
  Balance2: {params: ['left', 'right', 'pos', 'level'], numOutputs: 2},

  // Delays
  DelayN: {params: ['in', 'maxDelayTime', 'delayTime'], numOutputs: 1},
  DelayL: {params: ['in', 'maxDelayTime', 'delayTime'], numOutputs: 1},
  DelayC: {params: ['in', 'maxDelayTime', 'delayTime'], numOutputs: 1},
  CombN: {params: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  CombL: {params: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  CombC: {params: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  AllpassN: {params: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  AllpassL: {params: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},
  AllpassC: {params: ['in', 'maxDelayTime', 'delayTime', 'decayTime'], numOutputs: 1},

  // Dynamics / Amplitude
  Decay: {params: ['in', 'decayTime'], numOutputs: 1},
  Decay2: {params: ['in', 'attackTime', 'decayTime'], numOutputs: 1},
  Integrator: {params: ['in', 'coef'], numOutputs: 1},
  Lag: {params: ['in', 'lagTime'], numOutputs: 1},
  Lag2: {params: ['in', 'lagTime'], numOutputs: 1},
  Lag3: {params: ['in', 'lagTime'], numOutputs: 1},

  // Effects
  FreeVerb: {params: ['in', 'mix', 'room', 'damp'], numOutputs: 1},
  FreeVerb2: {params: ['in', 'in2', 'mix', 'room', 'damp'], numOutputs: 2},

  // Triggers
  Trig: {params: ['in', 'dur'], numOutputs: 1},
  Trig1: {params: ['in', 'dur'], numOutputs: 1},
  TDelay: {params: ['trigger', 'dur'], numOutputs: 1},

  // Math / Utility
  Clip: {params: ['in', 'lo', 'hi'], numOutputs: 1},
  Wrap: {params: ['in', 'lo', 'hi'], numOutputs: 1},
  Fold: {params: ['in', 'lo', 'hi'], numOutputs: 1},
  LinLin: {params: ['in', 'srclo', 'srchi', 'dstlo', 'dsthi'], numOutputs: 1},
  DC: {params: ['in'], numOutputs: 1},

  // Done actions
  FreeSelf: {params: ['in'], numOutputs: 1},
  PauseSelf: {params: ['in'], numOutputs: 1},

  // Operators
  BinaryOpUGen: {params: ['a', 'b'], numOutputs: 1},
  UnaryOpUGen: {params: ['in'], numOutputs: 1},
  MulAdd: {params: ['in', 'mul', 'add'], numOutputs: 1},
};
