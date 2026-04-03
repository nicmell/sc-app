import {createContext} from '@lit/context';

export interface NodeState {
    nodeId: number;
    loaded: boolean;
    run: number;
    controls: Record<string, number>;
}

export type NodeContext = NodeState | undefined;

export const nodeContext = createContext<NodeContext>('node');
