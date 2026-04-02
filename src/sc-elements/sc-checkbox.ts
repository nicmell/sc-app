import {html, css, LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext} from './context.ts';
import {resolveInputRuntime, resolveControlNodeId} from './resolve.ts';
import {runtimeApi} from '@/lib/stores/api';
import {isControl} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {nodeSetMessage} from '@/lib/osc/messages.ts';
import './internal/sc-switch.ts';

export class ScCheckbox extends LitElement {
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

    private get _runtime() {
        return resolveInputRuntime(this.id, 'sc-checkbox');
    }

    get checked(): boolean {
        const rt = this._runtime;
        if (!rt) return false;
        const control = runtimeApi.getById(rt.targetId);
        return control && isControl(control) ? control.runtime.value !== 0 : false;
    }

    constructor() {
        super();
        new ContextConsumer(this, {context: nodeContext, subscribe: true});
        this.bind = '';
        this.width = 24;
        this.height = 24;
        this.src = '';
        this.fgcolor = 'var(--color-primary, #0a6dc4)';
        this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
    }

    onChange = (checked: boolean) => {
        const rt = this._runtime;
        if (checked !== this.checked && this.bind && rt) {
            const control = runtimeApi.getById(rt.targetId);
            if (!control || !isControl(control)) return;
            const value = checked ? 1 : 0;
            runtimeApi.setControl({id: rt.targetId, value});
            const nodeId = resolveControlNodeId(rt.targetId);
            oscService.send(nodeSetMessage(nodeId, {[control.runtime.name]: value}));
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
