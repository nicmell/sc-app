import {createContext} from '@lit/context';

export interface ScElement {
  tagName: string;
}

export interface ScNode {
  readonly nodeId: number;
}

export interface NodeContext {
  boxId: string;
  nodeId: number;
  path: string;
  loaded: boolean;
  running: boolean;
  state: Record<string, any>;
  registerElement(el: ScElement): void;
  unregisterElement(el: ScElement): void;
  onChange(target: string, value: number): void;
  onRun(isRunning: boolean): void;
}

export const nodeContext = createContext<NodeContext>('node');
