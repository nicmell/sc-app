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
  onChange(targetId: string, target: string, value: number): void;
  onRun(targetId: string, target: string, value: number): void;
  getControlValue(targetId: string, name: string): number | undefined;
  getRunValue(targetId: string): number | undefined;
}

export const nodeContext = createContext<NodeContext>('node');
