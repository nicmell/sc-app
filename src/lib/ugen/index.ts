// Core types
export { Rate, UGen, UGenOutput, type UGenInput, inputRate, maxRate } from './ugen';

// SynthDef builder
export { synthDef, SynthDef, type SynthDefJson } from './synthdef';

// Controls (named parameters)
export { control } from './control';

// UGen definition factories (for custom UGens)
export {
  defineUGen,
  defineMultiOutUGen,
  type UGenDef,
  type MultiOutUGenDef,
  type UGenSpec,
} from './define';

// Operators
export { binOp, unaryOp, mulAdd, binaryOps, unaryOps } from './operators';

// Binary encoding (for advanced use)
export { ByteWriter } from './encode';

// ═══════════════════════════════════════════════════════════════════════════
// Built-in UGens
// ═══════════════════════════════════════════════════════════════════════════

// Oscillators
export {
  SinOsc, Saw, Pulse, LFSaw, LFPulse, LFTri, Impulse,
  VarSaw, SyncSaw,
} from './ugens';

// Noise
export {
  WhiteNoise, PinkNoise, BrownNoise, ClipNoise,
  LFNoise0, LFNoise1, LFNoise2,
  Dust, Dust2,
} from './ugens';

// Filters
export {
  LPF, HPF, BPF, BRF, RLPF, RHPF, MoogFF,
} from './ugens';

// Envelopes / Lines
export { Line, XLine, Linen } from './ugens';

// I/O
export { Out, ReplaceOut, OffsetOut, In, InFeedback, LocalIn, LocalOut } from './ugens';

// Panning
export { Pan2, Balance2 } from './ugens';

// Delays
export {
  DelayN, DelayL, DelayC,
  CombN, CombL, CombC,
  AllpassN, AllpassL, AllpassC,
} from './ugens';

// Dynamics / Amplitude
export { Decay, Decay2, Integrator, Lag, Lag2, Lag3 } from './ugens';

// Effects
export { FreeVerb, FreeVerb2 } from './ugens';

// Triggers
export { Trig, Trig1, TDelay } from './ugens';

// Math / Utility
export { Clip, Wrap, Fold, LinLin, DC } from './ugens';

// Done actions
export { FreeSelf, PauseSelf } from './ugens';
