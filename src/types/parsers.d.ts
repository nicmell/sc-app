// ── Runtime types ─────────────────────────────────────────────────────────

export interface NodeRuntime {
  rootId: string;
  parentId: string;
  path: string[];
  enabled: boolean;
  run: number;
  loaded: boolean;
  nodeId: number;
}

export type ControlRuntime = {
  rootId: string;
  parentId: string;
  path: string[];
  enabled: boolean;
  name: string;
  value: number;
};

export type VarRuntime = {
  rootId: string;
  parentId: string;
  path: string[];
  enabled: boolean;
  name: string;
  value: number;
};

export type UgenRuntime = {
  rootId: string;
  parentId: string;
  path: string[];
  enabled: boolean;
};

export interface SynthDefRuntime {
  rootId: string;
  parentId: string;
  path: string[];
  enabled: boolean;
  loaded: boolean;
}

export interface InputRuntime {
  rootId: string;
  parentId: string;
  path: string[];
  enabled: boolean;
  targetId: string;
}

export interface RunRuntime {
  rootId: string;
  parentId: string;
  path: string[];
  enabled: boolean;
  targetId: string;
}

// ── Items ─────────────────────────────────────────────────────────────────

export interface UGenSpec {
  name: string;
  type: string;
  rate: string;
  inputs: Record<string, string>;
}

export interface ScPluginItem {
  type: 'sc-plugin';
  id: string;
  title?: string;
  error?: string;
  run: boolean;
  children: ScElementItem[];
  runtime: NodeRuntime;
}

export interface ScGroupItem {
  type: 'sc-group';
  id: string;
  name: string;
  run: boolean;
  children: ScElementItem[];
  runtime: NodeRuntime;
}

export interface ScSynthItem {
  type: 'sc-synth';
  id: string;
  name: string;
  bind: string;
  run: boolean;
  children: ScElementItem[];
  runtime: NodeRuntime;
}

export interface ScSynthDefItem {
  type: 'sc-synthdef';
  id: string;
  name: string;
  children: ScElementItem[];
  runtime: SynthDefRuntime;
}

export interface ScUgenItem {
  type: 'sc-ugen';
  id: string;
  name: string;
  ugen: string;
  rate: string;
  op?: string;
  children: ScElementItem[];
  runtime: UgenRuntime;
}

export interface ScControlItem {
  type: 'sc-control';
  id: string;
  name: string;
  value?: number;
  bind?: string;
  runtime: ControlRuntime;
}

export interface ScVarItem {
  type: 'sc-var';
  id: string;
  name: string;
  value?: number;
  runtime: VarRuntime;
}

export interface ScRangeItem {
  type: 'sc-range';
  id: string;
  bind: string;
  runtime: InputRuntime;
}

export interface ScCheckboxItem {
  type: 'sc-checkbox';
  id: string;
  bind: string;
  runtime: InputRuntime;
}

export interface ScSelectItem {
  type: 'sc-select';
  id: string;
  bind: string;
  children: ScElementItem[];
  runtime: InputRuntime;
}

export interface ScOptionItem {
  type: 'sc-option';
  id: string;
  value: number;
  label: string;
  runtime: UgenRuntime;
}

export interface ScRadioGroupItem {
  type: 'sc-radio-group';
  id: string;
  bind: string;
  orientation: 'horizontal' | 'vertical';
  children: ScElementItem[];
  runtime: InputRuntime;
}

export interface ScRadioItem {
  type: 'sc-radio';
  id: string;
  value: number;
  label: string;
  width: number;
  height: number;
  src: string;
  fgcolor: string;
  bgcolor: string;
  runtime: UgenRuntime;
}

export interface ScRunItem {
  type: 'sc-run';
  id: string;
  bind: string;
  runtime: RunRuntime;
}

export interface ScDisplayItem {
  type: 'sc-display';
  id: string;
  bind: string;
  format: string;
  runtime: InputRuntime;
}

export interface ScIfItem {
  type: 'sc-if';
  id: string;
  bind: string;
  children: ScElementItem[];
  runtime: InputRuntime;
}

export type ScNodeItem = ScGroupItem | ScSynthItem | ScPluginItem;

export type ScParentItem = ScPluginItem | ScGroupItem | ScSynthItem | ScUgenItem | ScIfItem | ScSynthDefItem | ScSelectItem | ScRadioGroupItem;

export type ScElementItem = ScPluginItem | ScGroupItem | ScSynthItem | ScSynthDefItem | ScUgenItem | ScControlItem | ScVarItem | ScRangeItem | ScCheckboxItem | ScRunItem | ScDisplayItem | ScIfItem | ScSelectItem | ScOptionItem | ScRadioGroupItem | ScRadioItem;

export type NodeType = ScElementItem["type"];

export type StripRuntime<T> = T extends { children: ScElementItem[] }
  ? Omit<T, 'runtime' | 'children'> & { children: StripRuntime<ScElementItem>[] }
  : Omit<T, 'runtime'>;

export type ScElementItemBase = StripRuntime<ScElementItem> & { _element?: Element };

// ── Overrides ─────────────────────────────────────────────────────────────

export interface ControlOverrideEntry {
  type: "control";
  rootId: string;
  targetPath: string;
  value: number;
}

export interface RunOverrideEntry {
  type: "run";
  rootId: string;
  targetPath: string;
  value: number;
}

export interface VarOverrideEntry {
  type: "var";
  rootId: string;
  targetPath: string;
  value: number;
}

export type OverrideEntry = ControlOverrideEntry | RunOverrideEntry | VarOverrideEntry;

export type PersistedOverrideEntry =
  | Omit<ControlOverrideEntry, 'rootId'>
  | Omit<RunOverrideEntry, 'rootId'>
  | Omit<VarOverrideEntry, 'rootId'>;
