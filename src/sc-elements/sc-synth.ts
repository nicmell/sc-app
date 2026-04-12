import {oscService} from '@/lib/osc';
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
        oscService.createSynth(this.id, this.bind, this.nodeId, this.groupId, this.getControls(), this.run);
        super._sendCreate();
    }

    protected _sendDestroy() {
        oscService.freeSynth(this.id, this.nodeId);
        super._sendDestroy();
    }
}
