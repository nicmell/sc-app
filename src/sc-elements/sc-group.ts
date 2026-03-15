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
    static properties = {
        ...ScNode.properties,
        running: {type: Boolean},
    };

    declare running: boolean;

    constructor() {
        super();
        this.running = true;
    }

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
