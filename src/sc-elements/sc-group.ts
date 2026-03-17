import {oscService} from '@/lib/osc';
import {
    newGroupMessage,
    groupTailMessage,
    groupFreeAllMessage,
    freeNodeMessage,
    nodeRunMessage
} from '@/lib/osc/messages.ts';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup extends ScNode {

    protected firstUpdated() {
        oscService.send(
            newGroupMessage(this.nodeId),
            nodeRunMessage(this.nodeId, this.running ? 1 : 0),
            groupTailMessage(this.groupId, -1),
        );
        this._loaded = true;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._loaded) {
            oscService.send(
                groupFreeAllMessage(this.nodeId),
                freeNodeMessage(this.nodeId),
            );
        }
    }
}
