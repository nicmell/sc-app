import {oscService} from '@/lib/osc';
import {runtimeApi} from '@/lib/stores/api';
import {
    newSynthMessage,
    freeNodeMessage,
    groupTailMessage,
    nodeRunMessage
} from '@/lib/osc/messages.ts';
import {ScNode} from './internal/sc-node.ts';

export class ScSynth extends ScNode {
    static properties = {
        ...ScNode.properties,
        bind: {type: String},
    };

    declare bind: string;

    constructor() {
        super();
        this.bind = 'default';
    }

    protected _sendCreate() {
        oscService.send(
            newSynthMessage(this.bind, this.nodeId, 0, 0, this.getControls()),
            nodeRunMessage(this.nodeId, this.run ? 1 : 0),
            groupTailMessage(this.groupId, -1),
        );
        super._sendCreate();
        runtimeApi.newSynth({id: this.id, nodeId: this.nodeId});
    }

    protected _sendDestroy() {
        oscService.send(freeNodeMessage(this.nodeId));
        super._sendDestroy();
        runtimeApi.freeSynth({id: this.id});
    }
}
