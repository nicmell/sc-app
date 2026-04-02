import {oscService} from '@/lib/osc';
import {runtimeApi} from '@/lib/stores/api';
import {
    newGroupMessage,
    groupTailMessage,
    groupFreeAllMessage,
    freeNodeMessage,
    nodeRunMessage
} from '@/lib/osc/messages.ts';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup extends ScNode {

    protected _onParentEnabledChanged(enabled: boolean) {
        if (enabled && !this._loaded) {
            this._sendCreate();
        } else if (!enabled && this._loaded) {
            this._sendDestroy();
        }
    }

    protected _sendCreate() {
        oscService.send(
            newGroupMessage(this.nodeId),
            nodeRunMessage(this.nodeId, this.run ? 1 : 0),
            groupTailMessage(this.groupId, -1),
        );
        this._loaded = true;
        runtimeApi.newGroup({id: this.id, nodeId: this.nodeId});
    }

    protected _sendDestroy() {
        oscService.send(
            groupFreeAllMessage(this.nodeId),
            freeNodeMessage(this.nodeId),
        );
        this._loaded = false;
        runtimeApi.freeGroup({id: this.id});
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._loaded) {
            this._sendDestroy();
        }
    }
}
