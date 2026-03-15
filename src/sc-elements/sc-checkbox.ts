import {html, css, LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import {getRuntimeValue} from '@/lib/runtime';
import {runtimeApi} from '@/lib/stores/api';
import {nodeContext} from './context.ts';
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

    private _node = new ContextConsumer(this, {context: nodeContext, subscribe: true});

    static styles = css`
        :host { display: inline-block; }
    `;

    get checked(): boolean {
        const boxRuntime = runtimeApi.getBox(this._node.value?.boxId() ?? '');
        if (!boxRuntime?.elements) return false;
        return (getRuntimeValue(boxRuntime.elements, runtimeApi.entries, this.id) ?? 0) !== 0;
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
            this._node.value?.onChange(this.id, this.bind, checked ? 1 : 0);
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
