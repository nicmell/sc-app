import {get} from "@/lib/utils/get";
import type {ScElementNode} from "./types";

export function findElementByPath(elements: ScElementNode[], path: string[]): ScElementNode | undefined {
  if (path.length === 0) return undefined;
  const [name, ...rest] = path;
  const el = elements.find(e => 'name' in e && e.name === name);
  if (!el || rest.length === 0) return el;
  if (el.type === 'sc-group') return findElementByPath(el.children, rest);
  return undefined;
}

export function computeState(elements: ScElementNode[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const el of elements) {
    if (el.type === 'sc-synth') {
      result[el.name] = el.controls;
    } else if (el.type === 'sc-group') {
      result[el.name] = computeState(el.children);
    }
  }
  return result;
}

export function setControls(element: ScElementNode, controls: Record<string, number>): void {
  if (element.type === 'sc-synth') {
    Object.assign(element.controls, controls);
  } else if (element.type === 'sc-group') {
    for (const child of element.children) {
      setControls(child, controls);
    }
  }
}

export function setRunning(element: ScElementNode, isRunning: boolean): void {
  if (element.type === 'sc-synth' || element.type === 'sc-group') {
    element.isRunning = isRunning;
  }
}

export function syncInputValues(elements: ScElementNode[]): void {
  const state = computeState(elements);
  for (const el of elements) {
    if (el.type === 'sc-range' || el.type === 'sc-checkbox') {
      const resolved = get(state, el.bind);
      if (typeof resolved === 'number') el.value = resolved;
    } else if (el.type === 'sc-group') {
      syncInputValues(el.children);
    }
  }
}

export function syncRunValues(elements: ScElementNode[]): void {
  for (const el of elements) {
    if (el.type === 'sc-run') {
      if (el.bind) {
        const target = elements.find(n => 'name' in n && n.name === el.bind);
        if (target && (target.type === 'sc-synth' || target.type === 'sc-group')) {
          el.value = target.isRunning ? 1 : 0;
        }
      }
    } else if (el.type === 'sc-group') {
      syncRunValues(el.children);
    }
  }
}

export function stripRuntime(elements: ScElementNode[]): ScElementNode[] {
  return elements.map(el => {
    if (el.type === 'sc-synth') {
      const {isRunning: _, ...rest} = el;
      return rest;
    }
    if (el.type === 'sc-group') {
      const {isRunning: _, ...rest} = el;
      return {...rest, children: stripRuntime(el.children)};
    }
    return el;
  });
}
