import {createContext} from '@lit/context';
import type {ScGroupNode, ScSynthNode, ScPluginNode} from '@/types/parsers';

export type NodeContext = ScGroupNode | ScSynthNode | ScPluginNode | undefined;

export const nodeContext = createContext<NodeContext>('node');
