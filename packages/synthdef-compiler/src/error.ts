/**
 * Error class thrown by the SynthDef compiler (unknown UGen names,
 * rate mismatches, malformed SCgf bytes).
 */
export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompileError';
  }
}
