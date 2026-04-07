import {html, css} from 'lit';
import {ContextProvider, createContext} from '@lit/context';
import type {ScSelectItem, ScOptionItem} from '@/types/parsers';
import {runtimeApi} from '@/lib/stores/api';
import {isOption} from '@/lib/utils/guards';
import {ScInput} from './internal/sc-input.ts';

export interface SelectContext {
    value: number;
    open: boolean;
    select(value: number): void;
}

export const selectContext = createContext<SelectContext>('sc-select');

export class ScSelect extends ScInput<ScSelectItem> {
    static properties = {
        bind: {type: String},
        _open: {state: true},
    };

    declare bind: string;
    declare _open: boolean;

    private _provider!: ContextProvider<{ __context__: SelectContext }, this>;

    static styles = css`
        :host {
            display: inline-block;
            position: relative;
            font-family: system-ui, sans-serif;
            font-size: 13px;
        }
        .combobox {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 2px 6px;
            border: 1px solid var(--color-border, #555);
            border-radius: 8px;
            background: var(--color-surface, #2a2a2a);
            color: var(--color-text, #e0e0e0);
            cursor: pointer;
            user-select: none;
            min-width: 60px;
        }
        .combobox:hover {
            border-color: var(--color-primary, #0a6dc4);
        }
        .combobox-label {
            flex: 1;
        }
        .combobox-arrow {
            font-size: 10px;
            opacity: 0.6;
        }
        .dropdown {
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            z-index: 10;
            margin-top: 2px;
            border: 1px solid var(--color-border, #555);
            border-radius: 8px;
            background: var(--color-surface, #2a2a2a);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            overflow: hidden;
        }
    `;

    private get _options(): ScOptionItem[] {
        try {
            const node = runtimeApi.getById(this.id) as ScSelectItem | undefined;
            return (node?.children ?? []).filter((c): c is ScOptionItem => isOption(c));
        } catch {
            return [];
        }
    }

    private get _selectedLabel(): string {
        const current = this._state;
        const match = this._options.find(o => o.value === current);
        return match?.label ?? String(current);
    }

    constructor() {
        super();
        this.bind = '';
        this._open = false;
        this._provider = new ContextProvider(this, {
            context: selectContext,
            initialValue: {value: 0, open: false, select: () => {}},
        });
    }

    private _toggle = () => {
        this._open = !this._open;
        this._updateContext();
    };

    private _select = (value: number) => {
        this._open = false;
        this._updateContext();
        if (value !== this._state && this.bind) {
            this._dispatchChange(value);
        }
    };

    private _onKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._toggle();
        } else if (e.key === 'Escape' && this._open) {
            this._open = false;
            this._updateContext();
        }
    };

    private _onClickOutside = (e: MouseEvent) => {
        if (this._open && !this.contains(e.target as Node)) {
            this._open = false;
            this._updateContext();
        }
    };

    private _updateContext() {
        this._provider.setValue({
            value: this._state,
            open: this._open,
            select: this._select,
        }, true);
    }

    protected _onStateChange(prev: number, next: number) {
        super._onStateChange(prev, next);
        this._updateContext();
    }

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener('click', this._onClickOutside);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener('click', this._onClickOutside);
    }

    render() {
        this._updateContext();
        return html`
            <div class="combobox"
                role="combobox"
                tabindex="0"
                aria-expanded=${this._open}
                @click=${this._toggle}
                @keydown=${this._onKeydown}>
                <span class="combobox-label">${this._selectedLabel}</span>
                <span class="combobox-arrow">${this._open ? '\u25B2' : '\u25BC'}</span>
            </div>
            ${this._open ? html`
                <div class="dropdown" role="listbox">
                    <slot></slot>
                </div>
            ` : ''}
        `;
    }
}
