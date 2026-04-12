import {oscService} from '@/lib/osc';
import {runtimeApi} from '@/lib/stores/api';
import type {ScGroupItem, ScPluginItem} from '@/types/parsers';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup<T extends ScGroupItem | ScPluginItem = ScGroupItem> extends ScNode<T> {

    protected _sendCreate() {
        oscService.createGroup(this.nodeId, this.groupId, this.run);
        super._sendCreate();
        runtimeApi.newGroup({id: this.id, nodeId: this.nodeId});
    }

    protected _sendDestroy() {
        oscService.freeGroup(this.nodeId);
        super._sendDestroy();
        runtimeApi.freeGroup({id: this.id});
    }
}
