import {html} from 'lit';
import type {ScVarNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isVar} from '@/lib/utils/guards';
import {ScElement} from './internal/sc-element.ts';

export class ScVar extends ScElement<ScVarNode, number> {
    static properties = {
        name: {type: String, reflect: true},
        value: {type: Number},
    };

    declare name: string;
    declare value: number | undefined;

    getState(state: RuntimeState): number {
        const node = state.nodes[this.id];
        return node && isVar(node) ? node.runtime.value : 0;
    }

    render() {
        return html``;
    }
}
