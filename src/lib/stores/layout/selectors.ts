import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";
import {findElementByPath, computeState} from "@/lib/parsers";

const createLayoutSelector: SliceSelector<typeof root.layout> = (fn) =>
  createSelector(root.layout, fn);

export default {
  // state
  items: createLayoutSelector(s => s.items),
  options: createLayoutSelector(s => s.options),
  getById: (id: string) => createLayoutSelector(s => s.items.find(item => item.i === id)),
  elementState: (boxId: string, path?: string[]) => createLayoutSelector(s => {
    const box = s.items.find(item => item.i === boxId);
    if (!box?.elements) return {};
    if (!path || path.length === 0) return computeState(box.elements);
    const el = findElementByPath(box.elements, path);
    if (!el) return {};
    if (el.type === 'sc-synth') return el.controls;
    if (el.type === 'sc-group') return computeState(el.children);
    return {};
  }),
};
