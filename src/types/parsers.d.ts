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
  run: boolean;
  children: ScElementNode[];
  runtime: NodeRuntime;
}

export interface ScSynthNode {
  type: 'sc-synth';
  id: string;
  name: string;
  bind: string;
  run: boolean;
  children: ScElementNode[];
  runtime: NodeRuntime;
}

export type ControlRuntime = {
  rootId: string;
  parentId: string;
  path: string[];
  name: string;
  value: number
};

export type VarRuntime = {
  rootId: string;
  parentId: string;
  path: string[];
  name: string;
  value: number
};

export type UgenRuntime = {
  rootId: string;
  parentId: string;
  path: string[]
};

export interface SynthDefRuntime {
  rootId: string;
  parentId: string;
  path: string[];
  loaded: boolean
}

export interface NodeRuntime {
  rootId: string;
  parentId: string;
  path: string[];
  run: number;
  loaded: boolean;
  nodeId: number;
}
export interface PluginRuntime extends NodeRuntime {
  rootId: string;
  parentId: string;
  path: string[];
  run: number;
  loaded: boolean;
  error?: string;
  nodeId: number;
}

export interface ScUgenNode {
  type: 'sc-ugen';
  id: string;
  name: string;
  ugen: string;
  rate: string;
  op?: string;
  children: ScElementNode[];
  runtime: UgenRuntime;
}

export interface ScControlNode {
  type: 'sc-control';
  id: string;
  name: string;
  value?: number;
  bind?: string;
  runtime: ControlRuntime;
}

export interface ScVarNode {
  type: 'sc-var';
  id: string;
  name: string;
  value?: number;
  runtime: VarRuntime;
}

export interface ScSynthDefNode {
  type: 'sc-synthdef';
  id: string;
  name: string;
  children: ScElementNode[];
  runtime: SynthDefRuntime;
}

export interface InputRuntime {
  rootId: string;
  parentId: string;
  path: string[];
  targetId: string;
}

export interface RunRuntime {
  rootId: string;
  parentId: string;
  path: string[];
  targetId: string;
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
  runtime: RunRuntime;
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

export interface ScPluginNode {
  type: 'sc-plugin';
  id: string;
  title?: string;
  run: boolean;
  children: ScElementNode[];
  runtime: PluginRuntime;
}

export type ScParentNode = ScPluginNode | ScGroupNode | ScSynthNode | ScUgenNode | ScIfNode | ScSynthDefNode;

export type ScElementNode = ScPluginNode | ScGroupNode | ScSynthNode | ScSynthDefNode | ScUgenNode | ScControlNode | ScVarNode | ScRangeNode | ScCheckboxNode | ScRunNode | ScDisplayNode | ScIfNode;

export type NodeType = ScElementNode["type"]

export interface ControlOverrideEntry {
  type: "control";
  rootId: string;
  targetPath: string;
  value: number
}

export interface RunOverrideEntry {
  type: "run";
  rootId: string;
  targetPath: string;
  value: number
}

export interface VarOverrideEntry {
  type: "var";
  rootId: string;
  targetPath: string;
  value: number
}

export type OverrideEntry = ControlOverrideEntry | RunOverrideEntry | VarOverrideEntry;

export type PersistedOverrideEntry =
  | Omit<ControlOverrideEntry, 'rootId'>
  | Omit<RunOverrideEntry, 'rootId'>
  | Omit<VarOverrideEntry, 'rootId'>;

export type StripRuntime<T> = T extends { children: ScElementNode[] }
  ? Omit<T, 'runtime' | 'children'> & { children: StripRuntime<ScElementNode>[] }
  : Omit<T, 'runtime'>;

export type ScElementNodeBase = StripRuntime<ScElementNode> & { _element?: Element };

export interface ProcessHtmlResult {
  tree: ScElementNode[];
  nodes: Map<string, ScElementNode>;
}
