import {html} from 'lit';
import type {ScBufferItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {bufAllocMessage, bufFreeMessage} from '@/lib/osc/messages.ts';
import {runtimeApi} from '@/lib/stores/api';
import {ScElement} from './internal/sc-element.ts';

export class ScBuffer extends ScElement<ScBufferItem, boolean> {
    static properties = {
        name: {type: String, reflect: true},
        frames: {type: Number},
        channels: {type: Number},
    };

    declare name: string;
    declare frames: number;
    declare channels: number;

    readonly bufnum = oscService.nextBufNum();

    constructor() {
        super();
        this.name = '';
        this.frames = 44100;
        this.channels = 1;
    }

    getState(state: RuntimeState): boolean {
        const self = state.nodes[this.id];
        return self != null && isBuffer(self) && self.runtime.loaded;
    }

    protected _sendCreate() {
        oscService.send(bufAllocMessage(this.bufnum, this.frames, this.channels));
        super._sendCreate();
        runtimeApi.allocBuffer({id: this.id, bufnum: this.bufnum});
    }

    protected _sendDestroy() {
        oscService.send(bufFreeMessage(this.bufnum));
        super._sendDestroy();
        runtimeApi.freeBuffer({id: this.id});
    }

    render() {
        return html``;
    }
}
