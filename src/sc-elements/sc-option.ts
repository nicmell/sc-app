import {html} from 'lit';
import type {ScOptionNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {ScElement} from './internal/sc-element.ts';

export class ScOption extends ScElement<ScOptionNode, undefined> {
    static properties = {
        value: {type: Number},
        label: {type: String},
    };

    declare value: number;
    declare label: string;

    constructor() {
        super();
        this.value = 0;
        this.label = '';
    }

    getState(_state: RuntimeState): undefined {
        return undefined;
    }

    render() {
        return html``;
    }
}
