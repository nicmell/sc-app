import {oscService} from '@/lib/osc';
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

    protected firstUpdated() {
        oscService.send(
            newSynthMessage(this.bind, this.nodeId, 0, 0, this.getParams()),
            nodeRunMessage(this.nodeId, this.run ? 1 : 0),
            groupTailMessage(this.groupId, -1),
        );
        this._loaded = true;
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._loaded) {
            oscService.send(freeNodeMessage(this.nodeId));
        }
    }
}
