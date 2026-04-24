/**
 * Errors surfaced by the SynthDef compiler. Mirrors the Rust crate's
 * `CompileError` enum as a single class with a discriminated `kind`.
 */
export class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompileError';
  }
}
