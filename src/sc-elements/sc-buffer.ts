import {html} from 'lit';
import type {ScBufferItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
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
        oscService.allocBuffer(this.id, this.bufnum, this.frames, this.channels);
        super._sendCreate();
    }

    protected _sendDestroy() {
        oscService.freeBuffer(this.id, this.bufnum);
        super._sendDestroy();
    }

    render() {
        return html``;
    }
}
