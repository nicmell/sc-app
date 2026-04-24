import { Rate } from './rate.js';
import { ALL_SLICES } from './specs/index.js';

export interface UGenRegistryDefault {
  name: string;
  /** Declared default value; `null` if SC's source didn't specify one. */
  default: number | null;
}

export interface UGenRegistryArgDoc {
  name: string;
  doc: string;
}

/**
 * One UGen's registry entry. Mirrors the Rust `UGenRegistryEntry` — every
 * field preserved verbatim from the curated JSON specs.
 */
export interface UGenRegistryEntry {
  name: string;
  rates: Rate[];
  /**
   * Declared parameter order `(name, optional default)`. Matches SC's wire
   * order with the usual caveat that `channelsArray` / `inputArray` are
   * reordered to the end of the input list at compile time.
   */
  defaults: UGenRegistryDefault[];
  /** Output count. `null` means the source didn't specify it; scsynth treats that as 1. */
  numOutputs: number | null;
  /** Parent UGen name when this entry inherits args/rates via Overtone's `:extends`. */
  extends: string | null;
  summary: string | null;
  doc: string | null;
  signalRange: string | null;
  /** Per-argument documentation, sorted by argument name. */
  argDocs: UGenRegistryArgDoc[];
}

/**
 * Look up a UGen by its class name (e.g. `"SinOsc"`). Returns `null` if
 * the UGen isn't in the bundled registry.
 */
export function lookupUgen(name: string): UGenRegistryEntry | null {
  // Each per-category slice is independently sorted, so binary-search each
  // until one yields a hit.
  for (const [, slice] of ALL_SLICES) {
    const hit = binarySearch(slice, name);
    if (hit !== null) return hit;
  }
  return null;
}

/**
 * Return the full registry grouped by category (the JSON source file each
 * UGen came from). Each inner slice is sorted by UGen name.
 */
export function ugensByCategory(): readonly (readonly [string, readonly UGenRegistryEntry[]])[] {
  return ALL_SLICES;
}

function binarySearch(
  slice: readonly UGenRegistryEntry[],
  name: string,
): UGenRegistryEntry | null {
  let lo = 0;
  let hi = slice.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const cmp = slice[mid].name < name ? -1 : slice[mid].name > name ? 1 : 0;
    if (cmp === 0) return slice[mid];
    if (cmp < 0) lo = mid + 1;
    else hi = mid;
  }
  return null;
}
