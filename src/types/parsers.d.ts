import {RuntimeEntry} from "@/types/stores";

export interface UGenSpec {
  name: string;
  type: string;
  rate: string;
  inputs: Record<string, string>;
}

export interface NodeRuntime {
  run: string;                        // entry ID for isRunning state
  controls: Record<string, string>;   // control name → entry ID
}

export interface ScGroupNode {
  type: 'sc-group';
  id: string;
  boxId: string;
  name: string;
  isRunning: boolean;
  children: ScElementNode[];
  runtime: NodeRuntime;
}

export interface ScSynthNode {
  type: 'sc-synth';
  id: string;
  boxId: string;
  name: string;
  bind?: string;
  controls: Record<string, number>;
  isRunning: boolean;
  runtime: NodeRuntime;
}

export interface SynthDefRuntime {
  bytes: string;  // entry ID for compiled synthdef bytes
}

export interface ScSynthDefNode {
  type: 'sc-synthdef';
  id: string;
  boxId: string;
  name: string;
  params: Record<string, number>;
  ugens: UGenSpec[];
  runtime: SynthDefRuntime;
}

export interface InputRuntime {
  value: string;  // entry ID
}

export interface ScRangeNode {
  type: 'sc-range';
  id: string;
  boxId: string;
  bind: string;
  value: number;
  runtime: InputRuntime;
}

export interface ScCheckboxNode {
  type: 'sc-checkbox';
  id: string;
  boxId: string;
  bind: string;
  value: number;
  runtime: InputRuntime;
}

export interface ScRunNode {
  type: 'sc-run';
  id: string;
  boxId: string;
  bind: string;
  value: number;
  runtime: InputRuntime;
}

export interface ScMidiNode {
  type: 'sc-midi';
  id: string;
  boxId: string;
  bind: string;
  value: number;
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
  boxId: string;
  children: ScElementNode[];
  runtime: PluginRuntime;
}

export type ScElementNode = ScPluginNode | ScGroupNode | ScSynthNode | ScSynthDefNode | ScRangeNode | ScCheckboxNode | ScRunNode | ScMidiNode;

export interface PluginTreeEntry {
  plugin: ScPluginNode;
  entries: RuntimeEntry[];
  html: string;
}
