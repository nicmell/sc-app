import {html, svg, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import type {ScRadioItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {ScElement} from './internal/sc-element.ts';
import {radioGroupContext, type RadioGroupContext} from './sc-radio-group.ts';

export class ScRadio extends ScElement<ScRadioItem, undefined> {
    static properties = {
        value: {type: Number},
        label: {type: String},
        width: {type: Number, attribute: 'width'},
        height: {type: Number, attribute: 'height'},
        src: {type: String},
        fgcolor: {type: String},
        bgcolor: {type: String},
    };

    declare value: number;
    declare label: string;
    declare width: number;
    declare height: number;
    declare src: string;
    declare fgcolor: string;
    declare bgcolor: string;

    private _groupCtx: ContextConsumer<{ __context__: RadioGroupContext }, this>;

    static styles = css`
        :host {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            cursor: pointer;
            user-select: none;
        }
        svg, img { display: block; pointer-events: none; }
        .radio-label {
            font-family: system-ui, sans-serif;
            font-size: 13px;
            color: var(--color-text, #e0e0e0);
        }
    `;

    constructor() {
        super();
        this.value = 0;
        this.label = '';
        this.width = 24;
        this.height = 24;
        this.src = '';
        this.fgcolor = 'var(--color-primary, #0a6dc4)';
        this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
        this._groupCtx = new ContextConsumer(this, {
            context: radioGroupContext,
            subscribe: true,
        });
    }

    getState(_state: RuntimeState): undefined {
        return undefined;
    }

    private _onClick = () => {
        this._groupCtx.value?.select(this.value);
    };

    private get _selected(): boolean {
        return this._groupCtx.value?.value === this.value;
    }

    render() {
        const selected = this._selected;
        const w = this.width;
        const h = this.height;
        const fg = this.fgcolor;
        const bg = this.bgcolor;

        let indicator;
        if (this.src) {
            const yOff = selected ? -h : 0;
            indicator = html`<img
                width=${w}
                height=${h}
                style="object-fit: none; object-position: 0px ${yOff}px;"
                src=${this.src}
                alt=""
            />`;
        } else {
            const r = Math.min(w, h) * 0.5;
            indicator = html`
                <svg width=${w} height=${h} viewBox="0 0 ${w} ${h}">
                    <circle cx=${w * 0.5} cy=${h * 0.5} r=${r - 1} fill=${bg} />
                    ${selected
                        ? svg`<circle cx=${w * 0.5} cy=${h * 0.5} r=${r * 0.45} fill=${fg} />`
                        : ''}
                </svg>
            `;
        }

        return html`
            <span @click=${this._onClick}>
                ${indicator}
            </span>
            ${this.label ? html`<span class="radio-label">${this.label}</span>` : ''}
        `;
    }
}
