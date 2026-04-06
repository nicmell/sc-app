import {createContext} from '@lit/context';
import type {ScNodeItem} from '@/types/parsers';

export type NodeContext = ScNodeItem | undefined;

export const nodeContext = createContext<NodeContext>('node');
