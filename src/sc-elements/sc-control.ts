import {html} from 'lit';
import type {ScControlNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isControl} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {nodeSetMessage} from '@/lib/osc/messages.ts';
import {ScElement} from './internal/sc-element.ts';

export class ScControl extends ScElement<ScControlNode, number> {
    static properties = {
        name: {type: String, reflect: true},
        value: {type: Number},
        bind: {type: String},
    };

    declare name: string;
    declare value: number | undefined;
    declare bind: string | undefined;

    getState(state: RuntimeState): number {
        const node = state.nodes[this.id];
        return node && isControl(node) ? node.runtime.value : 0;
    }

    protected updated() {
        const nodeId = this._parent?.nodeId;
        if (nodeId) {
            oscService.send(nodeSetMessage(nodeId, {[this._runtime.name]: this._state}));
        }
    }

    render() {
        return html``;
    }
}
