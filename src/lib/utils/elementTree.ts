import type {ScElementItemBase, ScParentItem} from "../../types/parsers";
import {isParent} from "./guards";

export function findElementById<T extends ScElementItemBase>(elements: T[], id: string): T | undefined {
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

export function findElementByPath(parent: ScParentItem, path: string[]): ScElementItemBase | undefined {
  if (path.length === 0) return parent;
  const [name, ...rest] = path;
  const el = parent.children.find(e => 'name' in e && e.name === name);
  if (el) {
    if (rest.length === 0) return el;
    if (isParent(el)) return findElementByPath(el, rest);
    return undefined;
  }
  for (const child of parent.children) {
    if (isParent(child)) {
      const found = findElementByPath(child, path);
      if (found) return found;
    }
  }
  return undefined;
}
