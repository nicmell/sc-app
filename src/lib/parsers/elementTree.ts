import type {ScElementNode} from "../../types/parsers";
import {isParent} from "./guards";

export function findElementById(elements: ScElementNode[], id: string): ScElementNode | undefined {
  for (const el of elements) {
    if (el.id === id) return el;
    if (isParent(el)) {
      const found = findElementById(el.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function findElementByPath(elements: ScElementNode[], path: string[]): ScElementNode | undefined {
  if (path.length === 0) return undefined;
  const [name, ...rest] = path;
  const el = elements.find(e => 'name' in e && e.name === name);
  if (el) {
    if (rest.length === 0) return el;
    if (isParent(el)) return findElementByPath(el.children, rest);
    return undefined;
  }
  for (const child of elements) {
    if (isParent(child)) {
      const found = findElementByPath(child.children, path);
      if (found) return found;
    }
  }
  return undefined;
}
