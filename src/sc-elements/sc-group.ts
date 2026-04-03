import {oscService} from '@/lib/osc';
import {runtimeApi} from '@/lib/stores/api';
import {
    newGroupMessage,
    groupTailMessage,
    groupFreeAllMessage,
    freeNodeMessage,
    nodeRunMessage
} from '@/lib/osc/messages.ts';
import type {ScGroupNode, ScPluginNode} from '@/types/parsers';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup<T extends ScGroupNode | ScPluginNode = ScGroupNode> extends ScNode<T> {

    protected _sendCreate() {
        oscService.send(
            newGroupMessage(this.nodeId),
            nodeRunMessage(this.nodeId, this.run ? 1 : 0),
            groupTailMessage(this.groupId, -1),
        );
        super._sendCreate();
        runtimeApi.newGroup({id: this.id, nodeId: this.nodeId});
    }

    protected _sendDestroy() {
        oscService.send(
            groupFreeAllMessage(this.nodeId),
            freeNodeMessage(this.nodeId),
        );
        super._sendDestroy();
        runtimeApi.freeGroup({id: this.id});
    }
}
