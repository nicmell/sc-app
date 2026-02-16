import {createContext} from '@lit/context';

export interface ScElement {
  tagName: string;
  getParams(): Record<string, number>;
}

export interface SynthContext {
  nodeId: number;
  loaded: boolean;
  running: boolean;
  params: Record<string, number>;
  register(el: ScElement): void;
  unregister(el: ScElement): void;
  onChange(el: ScElement): void;
  onRun(isRunning: boolean): void;
}

export const synthContext = createContext<SynthContext>('synth');

export interface ScNode {
  readonly nodeId: number;
}

export interface GroupContext {
  nodeId: number;
  register(node: ScNode): void;
  unregister(node: ScNode): void;
}

export const groupContext = createContext<GroupContext>('group');
