import {html} from 'lit';
import type {ScControlNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isControl, isNode} from '@/lib/utils/guards';
import {runtimeApi} from '@/lib/stores/api';
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

    private _prev = 0;

    getState(state: RuntimeState): number {
        const node = state.nodes[this.id];
        return node && isControl(node) ? node.runtime.value : 0;
    }

    connectedCallback() {
        this._prev = this._state;
        super.connectedCallback();
    }

    protected updated() {
        const value = this._state;
        if (value !== this._prev) {
            this._prev = value;
            const parent = runtimeApi.getById(this._runtime.parentId);
            if (parent && isNode(parent) && parent.runtime.nodeId) {
                oscService.send(nodeSetMessage(parent.runtime.nodeId, {[this._runtime.name]: value}));
            }
        }
    }

    render() {
        return html``;
    }
}
