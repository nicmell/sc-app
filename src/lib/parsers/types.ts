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

export type ScElementNode = ScGroupNode | ScSynthNode | ScSynthDefNode;

export interface PluginTreeEntry {
  tree: ScElementNode[];
  state: Record<string, any>;
  html: string;
  title?: string;
}
