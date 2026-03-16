import type {ScElementNode, ScPluginNode, ScGroupNode, ScSynthNode, ScRangeNode, ScCheckboxNode, ScRunNode, ScIfNode} from "../../types/parsers";

export function isPlugin(el: ScElementNode): el is ScPluginNode {
  return el.type === 'sc-plugin';
}

export function isGroup(el: ScElementNode): el is ScGroupNode {
  return el.type === 'sc-group';
}

export function isParent(el: ScElementNode): el is ScPluginNode | ScGroupNode | ScIfNode {
  return el.type === 'sc-plugin' || el.type === 'sc-group' || el.type === 'sc-if';
}

export function isSynth(el: ScElementNode): el is ScSynthNode {
  return el.type === 'sc-synth';
}

export function isNode(el: ScElementNode): el is ScSynthNode | ScGroupNode {
  return el.type === 'sc-synth' || el.type === 'sc-group';
}

export function isInput(el: ScElementNode): el is ScRangeNode | ScCheckboxNode {
  return el.type === 'sc-range' || el.type === 'sc-checkbox';
}

export function isRun(el: ScElementNode): el is ScRunNode {
  return el.type === 'sc-run';
}
