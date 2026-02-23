import {html, css, LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext, type ScElement} from './context.ts';
import './internal/sc-switch.ts';

export class ScCheckbox extends LitElement implements ScElement {
    static properties = {
        param: {type: String},
        checked: {type: Boolean, reflect: true},
        width: {type: Number, attribute: 'width'},
        height: {type: Number, attribute: 'height'},
        src: {type: String},
        fgcolor: {type: String},
        bgcolor: {type: String},
    };

    declare param: string;
    declare checked: boolean;
    declare width: number;
    declare height: number;
    declare src: string;
    declare fgcolor: string;
    declare bgcolor: string;

    private _node = new ContextConsumer(this, {
        context: nodeContext, subscribe: true,
        callback: (ctx) => ctx?.registerElement(this),
    });

    static styles = css`
        :host { display: inline-block; }
    `;

    constructor() {
        super();
        this.param = '';
        this.checked = false;
        this.width = 24;
        this.height = 24;
        this.src = '';
        this.fgcolor = 'var(--color-primary, #0a6dc4)';
        this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._node.value?.unregisterElement(this);
    }

    getParams(): Record<string, number> {
        return this.param ? {[this.param]: this.checked ? 1 : 0} : {};
    }

    onChange = (checked: boolean) => {
        if (checked !== this.checked) {
            this.checked = checked;
            this._node.value?.onChange(this);
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
