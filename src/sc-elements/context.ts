import {createContext} from '@lit/context';

export interface ScElement {
  tagName: string;
  getParams(): Record<string, number>;
}

export interface SynthContext {
  nodeId: number;
  register(el: ScElement): void;
  unregister(el: ScElement): void;
  onChange(el: ScElement): void;
  onRun(isRunning: boolean): void;
}

export const synthContext = createContext<SynthContext>('synth');
