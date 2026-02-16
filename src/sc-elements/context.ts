import {createContext} from '@lit/context';

export interface ScElement {
  tagName: string;
  getParams(): Record<string, number>;
}

export interface ScNode {
  readonly nodeId: number;
}

export interface NodeContext {
  type: 'synth' | 'group';
  nodeId: number;
  loaded: boolean;
  running: boolean;
  params: Record<string, number>;
  registerElement(el: ScElement): void;
  unregisterElement(el: ScElement): void;
  registerNode(node: ScNode): void;
  unregisterNode(node: ScNode): void;
  onChange(el: ScElement): void;
  onRun(isRunning: boolean): void;
}

export const nodeContext = createContext<NodeContext>('node');
