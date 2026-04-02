import {css, html, LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext} from './context.ts';
import {resolveInputRuntime, resolveControlNodeId} from './resolve.ts';
import {runtimeApi} from '@/lib/stores/api';
import {isControl} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {nodeSetMessage} from '@/lib/osc/messages.ts';
import './internal/sc-knob.ts';
import './internal/sc-slider.ts';

export class ScRange extends LitElement {
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

    private get _runtime() {
        return resolveInputRuntime(this.id, 'sc-range');
    }

    get value(): number {
        const rt = this._runtime;
        if (!rt) return 0;
        const control = runtimeApi.getById(rt.targetId);
        return control && isControl(control) ? control.runtime.value : 0;
    }

    constructor() {
        super();
        new ContextConsumer(this, {context: nodeContext, subscribe: true});
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
        const rt = this._runtime;
        if (value !== this.value && this.bind && rt) {
            const control = runtimeApi.getById(rt.targetId);
            if (!control || !isControl(control)) return;
            runtimeApi.setControl({id: rt.targetId, value});
            const nodeId = resolveControlNodeId(rt.targetId);
            oscService.send(nodeSetMessage(nodeId, {[control.runtime.name]: value}));
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
