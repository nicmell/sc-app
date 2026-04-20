import { type UGenInput, Rate, currentContext } from './ugen';
import type { Rate as RateType } from './ugen';

/**
 * Declare a named control (parameter) in the current SynthDef.
 *
 * @param name         Parameter name exposed to scsynth.
 * @param defaultValue Initial value (default 0).
 * @param rate         Calculation rate (default Control / kr).
 * @returns A `UGenInput` resolving to the parameter's output slot on the
 *          SynthDef's shared Control / AudioControl UGen.
 *
 * @example
 * ```ts
 * const freq = control('freq', 440);            // control-rate
 * const amp  = control('amp', 0.5, Rate.Scalar); // scalar (set once)
 * ```
 */
export function control(
  name: string,
  defaultValue: number = 0,
  rate: RateType = Rate.Control,
): UGenInput {
  const ctx = currentContext();
  if (!ctx) {
    throw new Error('control() must be called inside a synthDef() function');
  }
  return ctx.addControl(name, defaultValue, rate);
}
