import type {ScElementNode, ScGroupNode} from "./types";
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
  if (isSynth(target)) return target.controls[control];
  if (isGroup(target)) return findDescendantControl(target, control);
  return undefined;
}

function findDescendantControl(group: ScGroupNode, control: string): number | undefined {
  for (const child of group.children) {
    if (isSynth(child) && control in child.controls) return child.controls[control];
    if (isGroup(child)) {
      const val = findDescendantControl(child, control);
      if (val !== undefined) return val;
    }
  }
  return undefined;
}

export function setControls(element: ScElementNode, controls: Record<string, number>): void {
  if (isSynth(element)) {
    Object.assign(element.controls, controls);
  } else if (isGroup(element)) {
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
      if (typeof value === 'number') el.value = value;
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
        target.isRunning = el.value !== 0;
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
        el.value = target.isRunning ? 1 : 0;
      }
    } else if (isGroup(el)) {
      syncRunValues(el.children, root, el);
    }
  }
}

export function stripRuntime(elements: ScElementNode[]): ScElementNode[] {
  return elements.map(el => {
    if (isSynth(el)) {
      const {isRunning: _, ...rest} = el;
      return rest;
    }
    if (isGroup(el)) {
      const {isRunning: _, ...rest} = el;
      return {...rest, children: stripRuntime(el.children)};
    }
    return el;
  });
}
