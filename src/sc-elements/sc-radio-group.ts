import {html, css} from 'lit';
import {ContextProvider, createContext} from '@lit/context';
import type {ScRadioGroupItem} from '@/types/parsers';
import {ScInput} from './internal/sc-input.ts';

export interface RadioGroupContext {
    value: number;
    select(value: number): void;
}

export const radioGroupContext = createContext<RadioGroupContext>('sc-radio-group');

export class ScRadioGroup extends ScInput<ScRadioGroupItem> {
    static properties = {
        bind: {type: String},
        orientation: {type: String, reflect: true},
    };

    declare bind: string;
    declare orientation: 'horizontal' | 'vertical';

    private _provider!: ContextProvider<{ __context__: RadioGroupContext }, this>;

    static styles = css`
        :host { display: inline-flex; gap: 4px; align-items: center; }
        :host([orientation="vertical"]) { flex-direction: column; align-items: flex-start; }
    `;

    constructor() {
        super();
        this.bind = '';
        this.orientation = 'horizontal';
        this._provider = new ContextProvider(this, {
            context: radioGroupContext,
            initialValue: {value: 0, select: () => {}},
        });
    }

    private _select = (value: number) => {
        if (value !== this._state && this.bind) {
            this._dispatchChange(value);
        }
    };

    protected _onStateChange(prev: number, next: number) {
        super._onStateChange(prev, next);
        this._provider.setValue({value: next, select: this._select}, true);
    }

    render() {
        return html`<slot></slot>`;
    }
}
