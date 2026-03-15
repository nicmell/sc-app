export type {RuntimeEntry} from "./types";
export {mergeRuntime} from "./merge";

import type {RuntimeEntry} from "./types";
import type {ScElementNode} from "@/lib/parsers/types";
import {isGroup, isSynth} from "@/lib/parsers/guards";

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
