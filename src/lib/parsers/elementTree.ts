import type {ScElementNode} from "../../types/parsers";
import {isGroup, isSynth, isNode, isInput, isRun} from "./guards";

export function findElementById(elements: ScElementNode[], id: string): ScElementNode | undefined {
  for (const el of elements) {
    if (el.id === id) return el;
    if (isGroup(el)) {
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
    if (isGroup(child)) {
      const found = findElementByPath(child.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

export function resolveControl(elements: ScElementNode[], bind: string): number | undefined {
  const segments = bind.split('.');
  const control = segments.pop()!;
  const target = findElementByPath(elements, segments);
  if (!target) return undefined;
  if (isSynth(target)) return target.runtime.controls[control];
  if (isGroup(target)) return target.runtime.controls[control];
  return undefined;
}

export function setControls(element: ScElementNode, controls: Record<string, number>): void {
  if (isSynth(element)) {
    Object.assign(element.runtime.controls, controls);
  } else if (isGroup(element)) {
    Object.assign(element.runtime.controls, controls);
    for (const child of element.children) {
      setControls(child, controls);
    }
  }
}

export function syncInputValues(elements: ScElementNode[], root?: ScElementNode[]): void {
  if (!root) root = elements;
  for (const el of elements) {
    if (isInput(el)) {
      const segments = el.bind.split('.');
      const target = findElementByPath(root, segments.slice(0, -1));
      if (target && isGroup(target)) continue;
      const value = resolveControl(root, el.bind);
      if (typeof value === 'number') el.runtime.value = value;
    } else if (isGroup(el)) {
      syncInputValues(el.children, root);
    }
  }
}

export function syncIsRunning(elements: ScElementNode[], root?: ScElementNode[], parent?: ScElementNode): void {
  if (!root) root = elements;
  for (const el of elements) {
    if (isRun(el)) {
      const target = el.bind
        ? findElementByPath(root, [el.bind])
        : parent;
      if (target && isNode(target)) {
        target.runtime.isRunning = el.runtime.value !== 0;
      }
    } else if (isGroup(el)) {
      syncIsRunning(el.children, root, el);
    }
  }
}

export function syncRunValues(elements: ScElementNode[], root?: ScElementNode[], parent?: ScElementNode): void {
  if (!root) root = elements;
  for (const el of elements) {
    if (isRun(el)) {
      const target = el.bind
        ? findElementByPath(root, [el.bind])
        : parent;
      if (target && isNode(target)) {
        el.runtime.value = target.runtime.isRunning ? 1 : 0;
      }
    } else if (isGroup(el)) {
      syncRunValues(el.children, root, el);
    }
  }
}

export function stripRuntime(elements: ScElementNode[]): ScElementNode[] {
  return elements.map(el => {
    if (isGroup(el)) {
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
