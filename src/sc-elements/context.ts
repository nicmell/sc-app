import {createContext} from '@lit/context';

export interface ScElement {
  tagName: string;
  getParams(): Record<string, number>;
}

export interface ScNode {
  readonly nodeId: number;
}

export interface NodeContext {
  id: string;
  type: 'synth' | 'group';
  nodeId: number;
  parent: NodeContext | undefined;
  loaded: boolean;
  running: boolean;
  params: Record<string, number>;
  registerElement(el: ScElement): void;
  unregisterElement(el: ScElement): void;
  onChange(el: ScElement): void;
  registerNode(node: ScNode): void;
  unregisterNode(node: ScNode): void;
  onRun(isRunning: boolean): void;
}

export const nodeContext = createContext<NodeContext>('node');

// ---------------------------------------------------------------------------
// SynthDef context — for declarative <sc-synthdef> / <sc-ugen>
// ---------------------------------------------------------------------------

export interface UGenElementSpec {
  id: string;
  type: string;
  rate: string;
  inputs: Record<string, string>;
}

export interface SynthDefContext {
  registerUGen(spec: UGenElementSpec): void;
  unregisterUGen(id: string): void;
}

export const synthdefContext = createContext<SynthDefContext>('synthdef');
