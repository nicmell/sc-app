import {html} from 'lit';
import type {ScRadioNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {ScElement} from './internal/sc-element.ts';

export class ScRadio extends ScElement<ScRadioNode, undefined> {
    static properties = {
        value: {type: Number},
        label: {type: String},
        width: {type: Number, attribute: 'width'},
        height: {type: Number, attribute: 'height'},
        src: {type: String},
        fgcolor: {type: String},
        bgcolor: {type: String},
    };

    declare value: number;
    declare label: string;
    declare width: number;
    declare height: number;
    declare src: string;
    declare fgcolor: string;
    declare bgcolor: string;

    constructor() {
        super();
        this.value = 0;
        this.label = '';
        this.width = 24;
        this.height = 24;
        this.src = '';
        this.fgcolor = 'var(--color-primary, #0a6dc4)';
        this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
    }

    getState(_state: RuntimeState): undefined {
        return undefined;
    }

    render() {
        return html``;
    }
}
