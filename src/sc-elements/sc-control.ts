import {html} from 'lit';
import type {ScControlNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isNode, isControl} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {nodeSetMessage} from '@/lib/osc/messages.ts';
import {ScElement} from './internal/sc-element.ts';

export class ScControl extends ScElement<ScControlNode> {
    static properties = {
        name: {type: String, reflect: true},
        value: {type: Number},
        bind: {type: String},
    };

    declare name: string;
    declare value: number | undefined;
    declare bind: string | undefined;

    getState(state: RuntimeState): number | undefined {
        const node = state.nodes[this.id];
        return node && isControl(node) ? node.runtime.value : undefined;
    }

    protected updated() {
        const value = this._state as number | undefined;
        if (value === undefined) return;
        const rt = this._runtime;
        const parent = runtimeApi.getById(rt.parentId);
        if (parent && isNode(parent) && parent.runtime.nodeId) {
            oscService.send(nodeSetMessage(parent.runtime.nodeId, {[rt.name]: value}));
        }
    }

    render() {
        return html``;
    }
}
