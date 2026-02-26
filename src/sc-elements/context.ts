import {createContext} from '@lit/context';

export interface ScElement {
  tagName: string;
}

export interface ScNode {
  readonly nodeId: number;
}

export interface NodeContext {
  nodeId: number;
  path: string;
  loaded: boolean;
  running: boolean;
  state: Record<string, any>;
  registerElement(el: ScElement): void;
  unregisterElement(el: ScElement): void;
  onChange(params: Record<string, number>): void;
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
