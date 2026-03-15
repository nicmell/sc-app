export interface UGenSpec {
  name: string;
  type: string;
  rate: string;
  inputs: Record<string, string>;
}

export interface NodeRuntime {
  isRunning: boolean;
  controls: Record<string, number>;
}

export interface ScGroupNode {
  type: 'sc-group';
  id: string;
  name: string;
  running: boolean;
  children: ScElementNode[];
  runtime: NodeRuntime;
}

export interface ScSynthNode {
  type: 'sc-synth';
  id: string;
  name: string;
  bind?: string;
  controls: Record<string, number>;
  running: boolean;
  runtime: NodeRuntime;
}

export interface SynthDefRuntime {
  value: number[];
}

export interface ScSynthDefNode {
  type: 'sc-synthdef';
  id: string;
  name: string;
  params: Record<string, number>;
  ugens: UGenSpec[];
  runtime: SynthDefRuntime;
}

export interface InputRuntime {
  value: number;
}

export interface ScRangeNode {
  type: 'sc-range';
  id: string;
  bind: string;
  runtime: InputRuntime;
}

export interface ScCheckboxNode {
  type: 'sc-checkbox';
  id: string;
  bind: string;
  runtime: InputRuntime;
}

export interface ScRunNode {
  type: 'sc-run';
  id: string;
  bind: string;
  runtime: InputRuntime;
}

export interface ScMidiNode {
  type: 'sc-midi';
  id: string;
  bind: string;
  octaves: number;
  octave: number;
  runtime: InputRuntime;
}

export interface PluginRuntime {
  loaded: boolean;
  error?: string;
  title?: string;
}

export interface ScPluginNode {
  type: 'sc-plugin';
  id: string;
  children: cElementNode[];
  loaded: boolean;
  error?: string;
  title?: string;
}


export type ScElementNode = ScGroupNode | ScSynthNode | ScSynthDefNode | ScRangeNode | ScCheckboxNode | ScRunNode | ScMidiNode;

export interface PluginTreeEntry {
  tree: ScElementNode[];
  html: string;
  title?: string;
}
