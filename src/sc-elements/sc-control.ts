import type {ScControlItem, ScElementItemBase} from '@/types/parsers';
import {isControl} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {ScState} from './internal/sc-state.ts';

export class ScControl extends ScState<ScControlItem> {
    static properties = {
        ...ScState.properties,
        bind: {type: String},
    };

    declare bind: string | undefined;

    protected _match(node: ScElementItemBase): node is ScControlItem {
        return isControl(node);
    }

    protected _onStateChange(_prev: number, next: number) {
        super._onStateChange(_prev, next);
        const nodeId = this._parent?.runtime.nodeId;
        if (this._runtime?.enabled && nodeId) {
            oscService.setControl(nodeId, this._runtime.name, next);
        }
    }
}
