export type {RuntimeEntry} from "./types";
export {mergeRuntime} from "./merge";

import type {RuntimeEntry} from "./types";
import type {ScElementNode} from "@/lib/parsers/types";
import {isNode, isInput, isRun, isGroup, isSynth} from "@/lib/parsers/guards";
import {findElementById, findElementByPath} from "@/lib/parsers/elementTree";

export function getRuntimeValue(elements: ScElementNode[], runtime: RuntimeEntry[], elementId: string): number | undefined {
  const el = findElementById(elements, elementId);
  if (!el || !(isInput(el) || isRun(el))) return undefined;
  return runtime.find(e => e.id === el.runtime.value)?.value;
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

