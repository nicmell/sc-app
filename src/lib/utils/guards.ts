import type {NodeType, ScElementNodeBase} from "../../types/parsers";
import {ELEMENTS} from "../../constants/sc-elements";

const NODE_TYPES: ReadonlySet<string> = new Set(Object.values(ELEMENTS));

export function isNodeType(value: string): value is NodeType {
  return NODE_TYPES.has(value);
}

export function isPlugin<T extends ScElementNodeBase>(el: T): el is Extract<T, { type: 'sc-plugin' }> {
  return el.type === 'sc-plugin';
}

export function isGroup<T extends ScElementNodeBase>(el: T): el is Extract<T, { type: 'sc-group' } | { type: 'sc-plugin' }> {
  return el.type === 'sc-group' || el.type === 'sc-plugin';
}

export function isParent<T extends ScElementNodeBase>(el: T): el is Extract<T, { type: 'sc-group' } | { type: 'sc-plugin' } | { type: 'sc-if' } | { type: 'sc-synthdef' }> {
  return el.type === 'sc-group' || el.type === 'sc-plugin' || el.type === 'sc-if' || el.type === 'sc-synthdef';
}

export function isSynth<T extends ScElementNodeBase>(el: T): el is Extract<T, { type: 'sc-synth' }> {
  return el.type === 'sc-synth';
}

export function isNode<T extends ScElementNodeBase>(el: T): el is Extract<T, { type: 'sc-synth' } | { type: 'sc-group' } | { type: 'sc-plugin' }> {
  return el.type === 'sc-synth' || el.type === 'sc-group' || el.type === 'sc-plugin';
}

export function isSynthDef<T extends ScElementNodeBase>(el: T): el is Extract<T, { type: 'sc-synthdef' }> {
  return el.type === 'sc-synthdef';
}

export function isInput<T extends ScElementNodeBase>(el: T): el is Extract<T, { type: 'sc-range' } | { type: 'sc-checkbox' }> {
  return el.type === 'sc-range' || el.type === 'sc-checkbox';
}

export function isVisual<T extends ScElementNodeBase>(el: T): el is Extract<T, { type: 'sc-display' } | { type: 'sc-if' }> {
  return el.type === 'sc-display' || el.type === 'sc-if';
}

export function isRun<T extends ScElementNodeBase>(el: T): el is Extract<T, { type: 'sc-run' }> {
  return el.type === 'sc-run';
}