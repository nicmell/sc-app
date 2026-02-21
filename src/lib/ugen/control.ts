import { type UGen, Rate, currentContext } from './ugen';
import type { Rate as RateType } from './ugen';

/**
 * Declare a named control (parameter) in the current SynthDef.
 *
 * @param name         Parameter name exposed to scsynth.
 * @param defaultValue Initial value (default 0).
 * @param rate         Calculation rate (default Control / kr).
 * @returns A UGen whose output is the parameter's current value at runtime.
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
): UGen {
  const ctx = currentContext();
  if (!ctx) {
    throw new Error('control() must be called inside a synthDef() function');
  }
  return ctx.addControl(name, defaultValue, rate);
}
