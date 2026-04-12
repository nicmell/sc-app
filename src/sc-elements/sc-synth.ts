import {oscService} from '@/lib/osc';
import {runtimeApi} from '@/lib/stores/api';
import type {ScSynthItem} from '@/types/parsers';
import {ScNode} from './internal/sc-node.ts';

export class ScSynth extends ScNode<ScSynthItem> {
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
        oscService.createSynth(this.bind, this.nodeId, this.groupId, this.getControls(), this.run);
        super._sendCreate();
        runtimeApi.newSynth({id: this.id, nodeId: this.nodeId});
    }

    protected _sendDestroy() {
        oscService.freeSynth(this.nodeId);
        super._sendDestroy();
        runtimeApi.freeSynth({id: this.id});
    }
}
