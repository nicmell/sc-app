import {oscService} from '@/lib/osc';
import {runtimeApi} from '@/lib/stores/api';
import type {ScGroupItem, ScPluginItem} from '@/types/parsers';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup<T extends ScGroupItem | ScPluginItem = ScGroupItem> extends ScNode<T> {

    protected async _sendCreate() {
        super._sendCreate();
        await oscService.createGroup(this.nodeId, this.groupId, this.run);
        runtimeApi.newGroup({id: this.id, nodeId: this.nodeId});
    }

    protected async _sendDestroy() {
        super._sendDestroy();
        await oscService.freeGroup(this.nodeId);
        runtimeApi.freeGroup({id: this.id});
    }
}
