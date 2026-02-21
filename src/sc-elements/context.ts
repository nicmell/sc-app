import {createContext} from '@lit/context';

export interface ScElement {
  tagName: string;
  getInputs(): Record<string, any>;
}

export interface ScUGenData {
  readonly type: string;
  readonly rate: string;
  readonly id: string;
  getAttribute(name: string): string | null;
}

export interface ScNode {
  readonly nodeId: number;
}

export interface NodeContext {
  type: 'synth' | 'group';
  nodeId: number;
  loaded: boolean;
  running: boolean;
  inputs: Record<string, any>;
  registerElement(el: ScElement): void;
  unregisterElement(el: ScElement): void;
  registerUGen(el: ScUGenData): void;
  unregisterUGen(el: ScUGenData): void;
  registerNode(node: ScNode): void;
  unregisterNode(node: ScNode): void;
  onChange(el: ScElement): void;
  onRun(isRunning: boolean): void;
}

export const nodeContext = createContext<NodeContext>('node');
