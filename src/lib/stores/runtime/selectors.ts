import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";
import {findElementById, findElementByPath} from "@/lib/parsers/elementTree";
import {isNode, isInput, isRun} from "@/lib/parsers/guards";

const createRuntimeSelector: SliceSelector<typeof root.runtime> = (fn) =>
  createSelector(root.runtime, fn);

export default {
  entries: createRuntimeSelector(s => s.entries),
  elements: createRuntimeSelector(s => s.elements),
  getBox: (id: string) => createRuntimeSelector(s => s.elements.find(p => p.id === id)),

  getValue: (boxId: string, elementId: string) => createRuntimeSelector(s => {
    const plugin = s.elements.find(p => p.id === boxId);
    if (!plugin) return undefined;
    const el = findElementById(plugin.children, elementId);
    if (!el || !(isInput(el) || isRun(el))) return undefined;
    return s.entries.find(e => e.id === el.runtime.value)?.value;
  }),

  resolveControl: (boxId: string, bind: string) => createRuntimeSelector(s => {
    const plugin = s.elements.find(p => p.id === boxId);
    if (!plugin) return undefined;
    const segments = bind.split('.');
    const control = segments.pop()!;
    const target = findElementByPath(plugin.children, segments);
    if (!target || !isNode(target)) return undefined;
    const entryId = target.runtime.controls[control];
    if (!entryId) return undefined;
    return s.entries.find(e => e.id === entryId)?.value;
  }),

  getControls: (boxId: string, elementId: string) => createRuntimeSelector(s => {
    const plugin = s.elements.find(p => p.id === boxId);
    if (!plugin) return {};
    const el = findElementById(plugin.children, elementId);
    if (!el || !isNode(el)) return {};
    const result: Record<string, number> = {};
    for (const [name, entryId] of Object.entries(el.runtime.controls)) {
      const entry = s.entries.find(e => e.id === entryId);
      if (entry) result[name] = entry.value;
    }
    return result;
  }),
};
