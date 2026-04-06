import {html, css} from 'lit';
import type {ScSelectItem, ScOptionItem} from '@/types/parsers';
import {runtimeApi} from '@/lib/stores/api';
import {isOption} from '@/lib/utils/guards';
import {ScInput} from './internal/sc-input.ts';

export class ScSelect extends ScInput<ScSelectItem> {
    static properties = {
        bind: {type: String},
    };

    declare bind: string;

    static styles = css`
        :host { display: inline-block; }
    `;

    private get _options(): ScOptionItem[] {
        try {
            const node = runtimeApi.getById(this.id) as ScSelectItem | undefined;
            return (node?.children ?? []).filter((c): c is ScOptionItem => isOption(c));
        } catch {
            return [];
        }
    }

    constructor() {
        super();
        this.bind = '';
    }

    private _onChange = (e: Event) => {
        const value = Number((e.target as HTMLSelectElement).value);
        if (value !== this._state && this.bind) {
            this._dispatchChange(value);
        }
    };

    render() {
        return html`
            <select .value=${String(this._state)} @change=${this._onChange}>
                ${this._options.map(o => html`
                    <option value=${o.value}>${o.label}</option>
                `)}
            </select>
        `;
    }
}
