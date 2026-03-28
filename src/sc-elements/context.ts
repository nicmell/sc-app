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
  onChange(targetNode: string, target: string, value: number): void;
  onRun(targetNode: string, target: string, value: number): void;
  getControlValue(targetNode: string, name: string): number | undefined;
  getRunValue(targetNode: string): number | undefined;
}

export const nodeContext = createContext<NodeContext>('node');
