import type {RuntimeEntry} from "./types";

export function mergeRuntime(defaults: RuntimeEntry[], existing: RuntimeEntry[]): RuntimeEntry[] {
  const existingById = new Map<string, RuntimeEntry>();
  for (const entry of existing) {
    existingById.set(entry.id, entry);
  }
  return defaults.map(def => {
    const prev = existingById.get(def.id);
    return prev ? {...def, value: prev.value} : def;
  });
}
