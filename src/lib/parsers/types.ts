export interface ScGroupNode {
  type: 'sc-group';
  id: string;
  name: string;
  children: ScElementNode[];
  isRunning?: boolean;
}

export interface ScSynthNode {
  type: 'sc-synth';
  id: string;
  name: string;
  synthdef?: string;
  controls: Record<string, number>;
  isRunning?: boolean;
}

export interface ScSynthDefNode {
  type: 'sc-synthdef';
  id: string;
  name: string;
  bytes: number[];
}

export interface ScRangeNode {
  type: 'sc-range';
  id: string;
  bind: string;
  value: number;
}

export interface ScCheckboxNode {
  type: 'sc-checkbox';
  id: string;
  bind: string;
  value: number;
}

export type ScElementNode = ScGroupNode | ScSynthNode | ScSynthDefNode | ScRangeNode | ScCheckboxNode;

export interface PluginTreeEntry {
  tree: ScElementNode[];
  html: string;
  title?: string;
}
