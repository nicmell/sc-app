import {html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import type {ScOptionItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {ScElement} from './internal/sc-element.ts';
import {selectContext, type SelectContext} from './sc-select.ts';

export class ScOption extends ScElement<ScOptionItem, undefined> {
    static properties = {
        value: {type: Number},
        label: {type: String},
    };

    declare value: number;
    declare label: string;

    private _selectCtx: ContextConsumer<{ __context__: SelectContext }, this>;

    static styles = css`
        :host {
            display: block;
        }
        .option {
            padding: 4px 8px;
            cursor: pointer;
            user-select: none;
            font-family: system-ui, sans-serif;
            font-size: 13px;
            color: var(--color-text, #e0e0e0);
        }
        .option:hover {
            background: var(--color-surface-active, #3a3a3a);
        }
        .option[aria-selected="true"] {
            color: var(--color-primary, #0a6dc4);
            font-weight: 600;
        }
    `;

    constructor() {
        super();
        this.value = 0;
        this.label = '';
        this._selectCtx = new ContextConsumer(this, {
            context: selectContext,
            subscribe: true,
        });
    }

    getState(_state: RuntimeState): undefined {
        return undefined;
    }

    private _onClick = () => {
        this._selectCtx.value?.select(this.value);
    };

    render() {
        const selected = this._selectCtx.value?.value === this.value;
        return html`
            <div class="option"
                role="option"
                aria-selected=${selected}
                @click=${this._onClick}>
                ${this.label}
            </div>
        `;
    }
}
