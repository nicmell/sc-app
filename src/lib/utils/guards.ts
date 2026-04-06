import type {NodeType, ScElementItemBase, OverrideEntry, ControlOverrideEntry, RunOverrideEntry, VarOverrideEntry} from "../../types/parsers";
import {ELEMENTS} from "../../constants/sc-elements";

const NODE_TYPES: ReadonlySet<string> = new Set(Object.values(ELEMENTS));

export function isNodeType(value: string): value is NodeType {
  return NODE_TYPES.has(value);
}

export function isPlugin<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-plugin' }> {
  return el.type === 'sc-plugin';
}

export function isGroup<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-group' } | { type: 'sc-plugin' }> {
  return el.type === 'sc-group' || el.type === 'sc-plugin';
}

export function isParent<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-group' } | { type: 'sc-plugin' } | { type: 'sc-synth' } | { type: 'sc-ugen' } | { type: 'sc-if' } | { type: 'sc-synthdef' } | { type: 'sc-select' } | { type: 'sc-radio-group' }> {
  return el.type === 'sc-group' || el.type === 'sc-plugin' || el.type === 'sc-synth' || el.type === 'sc-ugen' || el.type === 'sc-if' || el.type === 'sc-synthdef' || el.type === 'sc-select' || el.type === 'sc-radio-group';
}

export function isSynth<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-synth' }> {
  return el.type === 'sc-synth';
}

export function isNode<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-synth' } | { type: 'sc-group' } | { type: 'sc-plugin' }> {
  return el.type === 'sc-synth' || el.type === 'sc-group' || el.type === 'sc-plugin';
}

export function isSynthDef<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-synthdef' }> {
  return el.type === 'sc-synthdef';
}

export function isInput<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-range' } | { type: 'sc-checkbox' } | { type: 'sc-select' } | { type: 'sc-radio-group' }> {
  return el.type === 'sc-range' || el.type === 'sc-checkbox' || el.type === 'sc-select' || el.type === 'sc-radio-group';
}

export function isVisual<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-display' } | { type: 'sc-if' }> {
  return el.type === 'sc-display' || el.type === 'sc-if';
}

export function isUgen<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-ugen' }> {
  return el.type === 'sc-ugen';
}

export function isRun<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-run' }> {
  return el.type === 'sc-run';
}

export function isControl<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-control' }> {
  return el.type === 'sc-control';
}

export function isVar<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-var' }> {
  return el.type === 'sc-var';
}

export function isState<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-control' } | { type: 'sc-var' }> {
  return el.type === 'sc-control' || el.type === 'sc-var';
}

export function isSelect<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-select' }> {
  return el.type === 'sc-select';
}

export function isOption<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-option' }> {
  return el.type === 'sc-option';
}

export function isRadioGroup<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-radio-group' }> {
  return el.type === 'sc-radio-group';
}

export function isRadio<T extends ScElementItemBase>(el: T): el is Extract<T, { type: 'sc-radio' }> {
  return el.type === 'sc-radio';
}

export function isControlOverride(e: OverrideEntry): e is ControlOverrideEntry {
  return e.type === 'control';
}

export function isRunOverride(e: OverrideEntry): e is RunOverrideEntry {
  return e.type === 'run';
}

export function isVarOverride(e: OverrideEntry): e is VarOverrideEntry {
  return e.type === 'var';
}
