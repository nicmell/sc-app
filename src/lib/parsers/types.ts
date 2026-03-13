export interface UGenSpec {
  name: string;
  type: string;
  rate: string;
  inputs: Record<string, string>;
}

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
  bind?: string;
  controls: Record<string, number>;
  isRunning?: boolean;
}

export interface ScSynthDefNode {
  type: 'sc-synthdef';
  id: string;
  name: string;
  params: Record<string, number>;
  ugens: UGenSpec[];
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

export interface ScRunNode {
  type: 'sc-run';
  id: string;
  bind: string;
  value: number;
}

export interface ScMidiNode {
  type: 'sc-midi';
  id: string;
  bind: string;
  value: number;
  octaves: number;
  octave: number;
}

export type ScElementNode = ScGroupNode | ScSynthNode | ScSynthDefNode | ScRangeNode | ScCheckboxNode | ScRunNode | ScMidiNode;

export interface PluginTreeEntry {
  tree: ScElementNode[];
  html: string;
  title?: string;
}
