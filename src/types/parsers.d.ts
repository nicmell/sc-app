export interface UGenSpec {
  name: string;
  type: string;
  rate: string;
  inputs: Record<string, string>;
}

export type RuntimeValueEntry =
  | { type: "control"; boxId: string; targetNode: string; name: string; value: number }
  | { type: "run"; boxId: string; targetNode: string; name: string; value: number };

export interface NodeRuntime {
  run: string;
  controls: Record<string, string>;
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
  bind: string;
  controls: Record<string, number>;
  running: boolean;
  runtime: NodeRuntime;
}

export type UgenRuntime = Record<string, never>;

export interface ScUgenNode {
  type: 'sc-ugen';
  id: string;
  name: string;
  ugen: string;
  rate: string;
  controls: Record<string, string>;
  runtime: UgenRuntime;
}

export interface ScSynthDefNode {
  type: 'sc-synthdef';
  id: string;
  name: string;
  controls: Record<string, number>;
  children: ScElementNode[];
  runtime: UgenRuntime;
}

export interface InputRuntime {
  value: string;
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

export interface ScDisplayNode {
  type: 'sc-display';
  id: string;
  bind: string;
  format: string;
  runtime: InputRuntime;
}

export interface ScIfNode {
  type: 'sc-if';
  id: string;
  bind: string;
  children: ScElementNode[];
  runtime: InputRuntime;
}

export interface PluginRuntime extends NodeRuntime {
  loaded: boolean;
  error?: string;
  title?: string;
}

export interface ScPluginNode {
  type: 'sc-plugin';
  id: string;
  children: ScElementNode[];
  runtime: PluginRuntime;
}

export type ScParentNode = ScPluginNode | ScGroupNode | ScIfNode | ScSynthDefNode;

export type ScElementNode = ScPluginNode | ScGroupNode | ScSynthNode | ScSynthDefNode | ScUgenNode | ScRangeNode | ScCheckboxNode | ScRunNode | ScDisplayNode | ScIfNode;

export type NodeType = ScElementNode["type"]

export type StripRuntime<T> = T extends { children: ScElementNode[] }
  ? Omit<T, 'runtime' | 'children'> & { children: StripRuntime<ScElementNode>[] }
  : Omit<T, 'runtime'>;

export type ScElementNodeBase = StripRuntime<ScElementNode>;

export interface ProcessHtmlResult {
  tree: ScElementNode[];
  nodes: Map<string, ScElementNode>;
}

export interface PluginTreeEntry {
  title: string;
  html: string;
  tree: ScElementNode[];
  values: Record<string, RuntimeValueEntry>;
  runtime: PluginRuntime;
}
