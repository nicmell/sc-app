import {html, css, LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext} from './context.ts';
import {runtimeApi} from '@/lib/stores/api';
import {findElementById} from '@/lib/utils/elementTree';
import {isInput} from '@/lib/utils/guards';
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

    private get _entryId(): string | undefined {
        const boxId = this._node.value?.boxId();
        if (!boxId) return undefined;
        const plugin = runtimeApi.getById(boxId);
        if (!plugin) return undefined;
        const el = findElementById(plugin.children, this.id);
        if (!el || !isInput(el)) return undefined;
        return el.runtime.value;
    }

    get checked(): boolean {
        const entryId = this._entryId;
        if (!entryId) return false;
        return (this._node.value?.getInputValue(entryId) ?? 0) !== 0;
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
        const entryId = this._entryId;
        if (checked !== this.checked && this.bind && entryId) {
            this._node.value?.onChange(entryId, this.bind, checked ? 1 : 0);
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
