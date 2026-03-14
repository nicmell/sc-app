import {get} from "@/lib/utils/get";
import type {ScElementNode} from "./types";
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
  if (!el || rest.length === 0) return el;
  if (isGroup(el)) return findElementByPath(el.children, rest);
  return undefined;
}

export function computeState(elements: ScElementNode[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const el of elements) {
    if (isSynth(el)) {
      result[el.name] = el.controls;
    } else if (isGroup(el)) {
      result[el.name] = computeState(el.children);
    }
  }
  return result;
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

export function syncInputValues(elements: ScElementNode[]): void {
  const state = computeState(elements);
  for (const el of elements) {
    if (isInput(el)) {
      const resolved = get(state, el.bind);
      if (typeof resolved === 'number') el.value = resolved;
    } else if (isGroup(el)) {
      syncInputValues(el.children);
    }
  }
}

export function syncIsRunning(elements: ScElementNode[]): void {
  for (const el of elements) {
    if (isRun(el) && el.bind) {
      const target = elements.find(n => 'name' in n && n.name === el.bind);
      if (target && isNode(target)) {
        target.isRunning = el.value !== 0;
      }
    } else if (isGroup(el)) {
      syncIsRunning(el.children);
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
