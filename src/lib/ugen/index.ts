// Core types
export {Rate, UGen, UGenOutput, type UGenInput, inputRate, maxRate} from './ugen';

// SynthDef builder
export {synthDef, SynthDef, type SynthDefJson} from './synthdef';

// Controls (named parameters)
export {control} from './control';

// UGen definition factories (for programmatic JS API)
export {defineUGen, defineMultiOutUGen, type UGenDef, type MultiOutUGenDef, type UGenSpec} from './define';

// Operators
export {binOp, unaryOp, mulAdd, binaryOps, unaryOps} from './operators';

// UGen registry
export {registerUGen, lookupUGen} from './registry';
