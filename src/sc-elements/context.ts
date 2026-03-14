import {createContext} from '@lit/context';

export interface ScElement {
  tagName: string;
}

export interface ScNode {
  readonly nodeId: number;
}

export interface NodeContext {
  nodeId: number;
  boxId(): string;
  registerElement(el: ScElement): void;
  unregisterElement(el: ScElement): void;
  onChange(elementId: string, target: string, value: number): void;
  onRun(elementId: string, target: string, value: number): void;
}

export const nodeContext = createContext<NodeContext>('node');
