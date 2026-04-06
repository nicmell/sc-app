import type {ScControlItem, ScElementItemBase} from '@/types/parsers';
import {isControl, isNode} from '@/lib/utils/guards';
import {runtimeApi} from '@/lib/stores/api';
import {oscService} from '@/lib/osc';
import {nodeSetMessage} from '@/lib/osc/messages.ts';
import {ScState} from './internal/sc-state.ts';

export class ScControl extends ScState<ScControlItem> {
    static properties = {
        ...ScState.properties,
        bind: {type: String},
    };

    declare bind: string | undefined;

    private _prev: number | undefined;

    protected _match(node: ScElementItemBase): node is ScControlItem {
        return isControl(node);
    }

    protected updated() {
        const value = this._state;
        if (this._prev === undefined) {
            this._prev = value;
            return;
        }
        if (value === this._prev) return;
        this._prev = value;
        const parent = runtimeApi.getById(this._runtime.parentId);
        if (parent && isNode(parent) && parent.runtime.nodeId) {
            oscService.send(nodeSetMessage(parent.runtime.nodeId, {[this._runtime.name]: value}));
        }
    }
}
