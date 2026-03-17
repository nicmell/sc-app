import type {
  ScElementNode,
  ScPluginNode,
  ScGroupNode,
  ScSynthNode,
  ScRangeNode,
  ScCheckboxNode,
  ScRunNode,
  ScIfNode,
  ScSynthDefNode, ScDisplayNode
} from "../../types/parsers";

export function isPlugin(el: ScElementNode): el is ScPluginNode {
  return el.type === 'sc-plugin';
}

export function isGroup(el: ScElementNode): el is ScGroupNode | ScPluginNode {
  return el.type === 'sc-group' || el.type === 'sc-plugin';
}

export function isParent(el: ScElementNode): el is ScGroupNode | ScPluginNode | ScIfNode {
  return el.type === 'sc-group' || el.type === 'sc-plugin' || el.type === 'sc-if';
}

export function isSynth(el: ScElementNode): el is ScSynthNode {
  return el.type === 'sc-synth';
}

export function isNode(el: ScElementNode): el is ScSynthNode | ScGroupNode | ScPluginNode {
  return el.type === 'sc-synth' || el.type === 'sc-group' || el.type === 'sc-plugin';
}

export function isSynthDef(el: ScElementNode): el is ScSynthDefNode {
  return el.type === 'sc-synthdef';
}

export function isInput(el: ScElementNode): el is ScRangeNode | ScCheckboxNode {
  return el.type === 'sc-range' || el.type === 'sc-checkbox';
}

export function isVisual(el: ScElementNode): el is ScDisplayNode {
  return el.type === 'sc-display' || el.type === 'sc-if';
}

export function isRun(el: ScElementNode): el is ScRunNode {
  return el.type === 'sc-run';
}
