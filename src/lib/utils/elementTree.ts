import type {ScElementNodeBase} from "../../types/parsers";
import {isParent} from "./guards";

export function findElementById<T extends ScElementNodeBase>(elements: T[], id: string): T | undefined {
  for (const el of elements) {
    if (el.id === id) return el;
    if (isParent(el)) {
      const found = findElementById(el.children as T[], id);
      if (found) {
        return found
      }
    }
  }
  return undefined;
}

export function findElementByPath<T extends ScElementNodeBase>(elements: T[], path: string[]): T | undefined {
  if (path.length === 0) return undefined;
  const [name, ...rest] = path;
  const el = elements.find(e => 'name' in e && e.name === name);
  if (el) {
    if (rest.length === 0) return el;
    if (isParent(el)) {
      return findElementByPath(el.children as T[], rest)
    }
    return undefined;
  }
  for (const child of elements) {
    if (isParent(child)) {
      const found = findElementByPath(child.children as T[], path);
      if (found) return found;
    }
  }
  return undefined;
}
