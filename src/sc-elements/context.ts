import {createContext} from '@lit/context';
import type {AnyElement, InputElement, NodeElement, UGenElement} from '@/types/stores';

export interface ScElement {
  tagName: string;
  getElement(): AnyElement | undefined;
}

export interface ScUGenData {
  readonly type: string;
  readonly rate: string;
  readonly id: string;
  getAttribute(name: string): string | null;
}

export interface NodeContext {
  type: 'synth' | 'group';
  nodeId: number;
  loaded: boolean;
  running: boolean;
  elements: AnyElement[];
  inputs: InputElement[];
  ugens: UGenElement[];
  nodes: NodeElement[];
  registerElement(el: ScElement): void;
  unregisterElement(el: ScElement): void;
  onChange(el: ScElement): void;
  onRun(isRunning: boolean): void;
}

export const nodeContext = createContext<NodeContext>('node');
