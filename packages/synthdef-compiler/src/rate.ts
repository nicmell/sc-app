import { CompileError } from './error.js';

/**
 * Calculation rate of a UGen. The on-wire encoding is a single i8
 * (scalar=0, control=1, audio=2); the API surface is a string union
 * for ergonomics.
 */
export type Rate = 'scalar' | 'control' | 'audio';

export const RATE_SCALAR_I8 = 0;
export const RATE_CONTROL_I8 = 1;
export const RATE_AUDIO_I8 = 2;

export function rateToI8(rate: Rate): number {
  switch (rate) {
    case 'scalar':
      return RATE_SCALAR_I8;
    case 'control':
      return RATE_CONTROL_I8;
    case 'audio':
      return RATE_AUDIO_I8;
  }
}

export function rateFromI8(v: number): Rate {
  switch (v) {
    case RATE_SCALAR_I8:
      return 'scalar';
    case RATE_CONTROL_I8:
      return 'control';
    case RATE_AUDIO_I8:
      return 'audio';
    default:
      throw new CompileError(`Unknown rate: "${v}"`);
  }
}

/** Parse SC short forms `ar` / `kr` / `ir` (case-insensitive). */
export function parseRate(s: string): Rate | null {
  switch (s.toLowerCase()) {
    case 'ar':
      return 'audio';
    case 'kr':
      return 'control';
    case 'ir':
      return 'scalar';
    default:
      return null;
  }
}
