import {oscService} from '@/lib/osc';
import type {ScGroupItem, ScPluginItem} from '@/types/parsers';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup<T extends ScGroupItem | ScPluginItem = ScGroupItem> extends ScNode<T> {

    protected _sendCreate() {
        oscService.createGroup(this.id, this.nodeId, this.groupId, this.run);
        super._sendCreate();
    }

    protected _sendDestroy() {
        oscService.freeGroup(this.id, this.nodeId);
        super._sendDestroy();
    }
}
