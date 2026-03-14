import type {ScElementNode, RuntimeEntry} from "./types";
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

export function resolveControl(elements: ScElementNode[], runtime: RuntimeEntry[], bind: string): number | undefined {
  const segments = bind.split('.');
  const control = segments.pop()!;
  const target = findElementByPath(elements, segments);
  if (!target || !isNode(target)) return undefined;
  const entryId = target.runtime.controls[control];
  if (!entryId) return undefined;
  return runtime.find(e => e.id === entryId)?.value;
}

export function setControls(element: ScElementNode, runtime: RuntimeEntry[], controls: Record<string, number>): void {
  if (isSynth(element)) {
    for (const [name, value] of Object.entries(controls)) {
      const entryId = element.runtime.controls[name];
      if (entryId) {
        const entry = runtime.find(e => e.id === entryId);
        if (entry) entry.value = value;
      }
    }
  } else if (isGroup(element)) {
    for (const [name, value] of Object.entries(controls)) {
      const entryId = element.runtime.controls[name];
      if (entryId) {
        const entry = runtime.find(e => e.id === entryId);
        if (entry) entry.value = value;
      }
    }
    for (const child of element.children) {
      setControls(child, runtime, controls);
    }
  }
}

export function getRuntimeValue(elements: ScElementNode[], runtime: RuntimeEntry[], elementId: string): number | undefined {
  const el = findElementById(elements, elementId);
  if (!el || !(isInput(el) || isRun(el))) return undefined;
  return runtime.find(e => e.id === el.runtime.value)?.value;
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
