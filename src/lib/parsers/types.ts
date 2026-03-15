import type {RuntimeEntry} from "@/lib/runtime/types";

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
  name: string;
  isRunning: boolean;
  children: ScElementNode[];
  runtime: NodeRuntime;
}

export interface ScSynthNode {
  type: 'sc-synth';
  id: string;
  name: string;
  bind?: string;
  controls: Record<string, number>;
  isRunning: boolean;
  runtime: NodeRuntime;
}

export interface ScSynthDefNode {
  type: 'sc-synthdef';
  id: string;
  name: string;
  params: Record<string, number>;
  ugens: UGenSpec[];
  bytes: number[];
}

export interface InputRuntime {
  value: string;  // entry ID
}

export interface ScRangeNode {
  type: 'sc-range';
  id: string;
  bind: string;
  value: number;
  runtime: InputRuntime;
}

export interface ScCheckboxNode {
  type: 'sc-checkbox';
  id: string;
  bind: string;
  value: number;
  runtime: InputRuntime;
}

export interface ScRunNode {
  type: 'sc-run';
  id: string;
  bind: string;
  value: number;
  runtime: InputRuntime;
}

export interface ScMidiNode {
  type: 'sc-midi';
  id: string;
  bind: string;
  value: number;
  octaves: number;
  octave: number;
  runtime: InputRuntime;
}

export type ScElementNode = ScGroupNode | ScSynthNode | ScSynthDefNode | ScRangeNode | ScCheckboxNode | ScRunNode | ScMidiNode;

export interface PluginTreeEntry {
  tree: ScElementNode[];
  runtime: RuntimeEntry[];
  html: string;
  title?: string;
}
