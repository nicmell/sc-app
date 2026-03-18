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
  onChange(entryId: string, target: string, value: number): void;
  onRun(entryId: string, target: string, value: number): void;
  getInputValue(entryId: string): number | undefined;
}

export const nodeContext = createContext<NodeContext>('node');
