import {css, html, LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import {getRuntimeValue} from '@/lib/runtime';
import {runtimeApi} from '@/lib/stores/api';
import {nodeContext} from './context.ts';
import './internal/sc-keyboard.ts';

export class ScMidi extends LitElement {
    static properties = {
        bind: {type: String},
        octaves: {type: Number},
        octave: {type: Number},
        width: {type: Number},
        'key-height': {type: Number, attribute: 'key-height'},
    };

    declare bind: string;
    declare octaves: number;
    declare octave: number;
    declare width: number;
    declare keyHeight: number;

    private _node = new ContextConsumer(this, {context: nodeContext, subscribe: true});

    static styles = css`:host { display: inline-block; }`;

    get value(): number {
        const boxRuntime = runtimeApi.getBox(this._node.value?.boxId() ?? '');
        if (!boxRuntime?.elements) return 0;
        return getRuntimeValue(boxRuntime.elements, runtimeApi.entries, this.id) ?? 0;
    }

    constructor() {
        super();
        this.bind = '';
        this.octaves = 2;
        this.octave = 4;
        this.width = 280;
        this.keyHeight = 120;
    }

    onChange = (hz: number) => {
        if (this.bind) {
            this._node.value?.onChange(this.id, this.bind, hz);
        }
    };

    onOctaveChange = (octave: number) => {
        this.octave = octave;
    };

    render() {
        return html`
            <sc-keyboard
                .onChange=${this.onChange}
                .octaves=${this.octaves}
                .octave=${this.octave}
                .onOctaveChange=${this.onOctaveChange}
                .activeNote=${this._midiFromHz(this.value)}
                .width=${this.width}
                .keyHeight=${this.keyHeight}
            ></sc-keyboard>`;
    }

    private _midiFromHz(hz: number): number {
        if (hz <= 0) return -1;
        return Math.round(69 + 12 * Math.log2(hz / 440));
    }
}
