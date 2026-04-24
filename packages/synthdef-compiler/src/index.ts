export { CompileError } from './error.js';
export type { Rate } from './rate.js';
export {
  RATE_SCALAR_I8,
  RATE_CONTROL_I8,
  RATE_AUDIO_I8,
  rateToI8,
  rateFromI8,
  parseRate,
} from './rate.js';
export type { UGenInput, UGenInputLike } from './ugen-input.js';
export { k, u, uo, toUGenInput, ugenIndex, outputIndex } from './ugen-input.js';
export { binaryOpIndex, unaryOpIndex } from './operators.js';
export { SynthDef, parseScgf } from './synthdef.js';
export type {
  SynthDefJson,
  UGenJson,
  InputSpec,
  OutputSpec,
  Parameters,
  ParamNameEntry,
} from './synthdef.js';
export { lookupUgen, ugensByCategory } from './registry.js';
export type { UGenRegistryEntry, UGenRegistryDefault } from './registry.js';
export * as builders from './builders/index.js';
export { synthdef, ar, kr, ir } from './sugar/index.js';
export type { Graph, GraphUGens, GraphOperators, ControlWrapper } from './sugar/index.js';
