import {html, css} from 'lit';
import type {ScCheckboxNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isInput, isControl} from '@/lib/utils/guards';
import {ScElement} from './internal/sc-element.ts';
import './internal/sc-switch.ts';

export class ScCheckbox extends ScElement<ScCheckboxNode> {
    static properties = {
        bind: {type: String},
        width: {type: Number, attribute: 'width'},
        height: {type: Number, attribute: 'height'},
        src: {type: String},
        fgcolor: {type: String},
        bgcolor: {type: String},
    };

    declare bind: string;
    declare width: number;
    declare height: number;
    declare src: string;
    declare fgcolor: string;
    declare bgcolor: string;

    static styles = css`
        :host { display: inline-block; }
    `;

    getState(state: RuntimeState): number | undefined {
        const self = state.nodes[this.id];
        if (!self || !isInput(self)) return undefined;
        const control = state.nodes[self.runtime.targetId];
        return control && isControl(control) ? control.runtime.value : undefined;
    }

    get checked(): boolean {
        return ((this._state as number) ?? 0) !== 0;
    }

    constructor() {
        super();
        this.bind = '';
        this.width = 24;
        this.height = 24;
        this.src = '';
        this.fgcolor = 'var(--color-primary, #0a6dc4)';
        this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
    }

    onChange = (checked: boolean) => {
        if (checked !== this.checked && this.bind) {
            runtimeApi.setControl({id: this._runtime.targetId, value: checked ? 1 : 0});
        }
    };

    render() {
        return html`
                <sc-switch
                        .onChange=${this.onChange}
                        .checked=${this.checked}
                        .width=${this.width}
                        .height=${this.height}
                        .src=${this.src}
                        .fgcolor=${this.fgcolor}
                        .bgcolor=${this.bgcolor}
                >
                </sc-switch>`;
    }
}
