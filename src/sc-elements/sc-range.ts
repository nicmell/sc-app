import {css, html} from 'lit';
import type {ScRangeNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isInput, isControl} from '@/lib/utils/guards';
import {ScElement} from './internal/sc-element.ts';
import './internal/sc-knob.ts';
import './internal/sc-slider.ts';

export class ScRange extends ScElement<ScRangeNode> {
    static properties = {
        type: {type: String},
        bind: {type: String},
        min: {type: Number},
        max: {type: Number},
        step: {type: Number},
        diameter: {type: Number},
        width: {type: Number, attribute: 'width'},
        height: {type: Number, attribute: 'height'},
        src: {type: String},
        sprites: {type: Number},
        fgcolor: {type: String},
        bgcolor: {type: String},
    };

    declare type: 'knob' | 'slider';
    declare bind: string;
    declare min: number;
    declare max: number;
    declare step: number;
    declare diameter: number;
    declare width: number;
    declare height: number;
    declare src: string;
    declare sprites: number;
    declare fgcolor: string;
    declare bgcolor: string;

    static styles = css`
        :host {
            display: inline-block;
        }
    `;

    getState(state: RuntimeState): number | undefined {
        const self = state.nodes[this.id];
        if (!self || !isInput(self)) return undefined;
        const control = state.nodes[self.runtime.targetId];
        return control && isControl(control) ? control.runtime.value : undefined;
    }

    get value(): number {
        return (this._state as number) ?? 0;
    }

    constructor() {
        super();
        this.type = 'knob';
        this.bind = '';
        this.min = 0;
        this.max = 1;
        this.step = 0.01;
        this.diameter = 64;
        this.width = 128;
        this.height = 20;
        this.src = '';
        this.sprites = 0;
        this.fgcolor = 'var(--color-primary, #0a6dc4)';
        this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
    }

    onChange = (value: number) => {
        if (value !== this.value && this.bind) {
            runtimeApi.setControl({id: this._runtime.targetId, value});
        }
    };

    render() {
        return this.type === 'knob'
            ? html`
                    <sc-knob
                            .onChange=${this.onChange}
                            .value=${this.value}
                            .min=${this.min}
                            .max=${this.max}
                            .step=${this.step}
                            .diameter=${this.diameter}
                            .src=${this.src}
                            .sprites=${this.sprites}
                            .fgcolor=${this.fgcolor}
                            .bgcolor=${this.bgcolor}
                    >
                    </sc-knob>`
            : html`
                    <sc-slider
                            .onChange=${this.onChange}
                            .value=${this.value}
                            .min=${this.min}
                            .max=${this.max}
                            .step=${this.step}
                            .width=${this.width}
                            .height=${this.height}
                            .src=${this.src}
                            .sprites=${this.sprites}
                            .fgcolor=${this.fgcolor}
                            .bgcolor=${this.bgcolor}>
                    </sc-slider>`;
    }
}
