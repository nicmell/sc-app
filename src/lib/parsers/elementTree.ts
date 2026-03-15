import type {ScElementNode} from "./types";
import {isGroup, isPlugin} from "./guards";

export function findElementById(elements: ScElementNode[], id: string): ScElementNode | undefined {
  for (const el of elements) {
    if (el.id === id) return el;
    if (isGroup(el) || isPlugin(el)) {
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
    if (isGroup(el)) return findElementByPath(el.children, rest);
    return undefined;
  }
  for (const child of elements) {
    if (isGroup(child) || isPlugin(child)) {
      const found = findElementByPath(child.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

export function stripRuntime(elements: ScElementNode[]): ScElementNode[] {
  return elements.map(el => {
    if (isGroup(el) || isPlugin(el)) {
      const {runtime: _, ...rest} = el;
      return {...rest, children: stripRuntime(el.children)} as ScElementNode;
    }
    if ('runtime' in el) {
      const {runtime: _, ...rest} = el;
      return rest as ScElementNode;
    }
    return el;
  });
}
