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

    protected _onParentEnabledChanged(enabled: boolean) {
        if (enabled && !this._loaded) {
            this._sendCreate();
        } else if (!enabled && this._loaded) {
            this._sendDestroy();
        }
    }

    private _sendCreate() {
        oscService.send(
            newSynthMessage(this.bind, this.nodeId, 0, 0, this.getParams()),
            nodeRunMessage(this.nodeId, this.run ? 1 : 0),
            groupTailMessage(this.groupId, -1),
        );
        this._loaded = true;
        runtimeApi.newSynth({id: this.id, nodeId: this.nodeId});
    }

    private _sendDestroy() {
        oscService.send(freeNodeMessage(this.nodeId));
        this._loaded = false;
        runtimeApi.freeSynth({id: this.id});
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._loaded) {
            this._sendDestroy();
        }
    }
}
