import {createContext} from '@lit/context';

export interface ScNode {
  readonly nodeId: number;
}

export interface NodeContext {
  nodeId: number;
  enabled: boolean;
}

export const nodeContext = createContext<NodeContext>('node');
