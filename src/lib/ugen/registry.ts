import type { UGenSpec } from './define';

// ---------------------------------------------------------------------------
// UGen registry — runtime lookup of UGen specs by class name
// ---------------------------------------------------------------------------

export interface UGenRegistryEntry extends UGenSpec {
  /** Whether this UGen was defined via defineMultiOutUGen. */
  multiOut?: boolean;
}

const registry = new Map<string, UGenRegistryEntry>();

export function registerUGen(entry: UGenRegistryEntry): void {
  registry.set(entry.name, entry);
}

export function lookupUGen(name: string): UGenRegistryEntry | undefined {
  return registry.get(name);
}

export const ugenRegistry = {
  register: registerUGen,
  lookup: lookupUGen,
  has: (name: string) => registry.has(name),
} as const;
