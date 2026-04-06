import {html, svg, css} from 'lit';
import type {ScRadioGroupNode, ScRadioNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isRadioGroup, isRadio, isControl, isVar} from '@/lib/utils/guards';
import {ScElement} from './internal/sc-element.ts';

export class ScRadioGroup extends ScElement<ScRadioGroupNode, number> {
    static properties = {
        bind: {type: String},
        orientation: {type: String, reflect: true},
    };

    declare bind: string;
    declare orientation: 'horizontal' | 'vertical';

    static styles = css`
        :host { display: inline-flex; gap: 4px; }
        :host([orientation="vertical"]) { flex-direction: column; }
        .radio-item { display: inline-flex; align-items: center; gap: 2px; cursor: pointer; user-select: none; }
        .radio-item svg, .radio-item img { display: block; pointer-events: none; }
        .radio-label { font-family: system-ui, sans-serif; font-size: 13px; }
    `;

    getState(state: RuntimeState): number {
        const self = state.nodes[this.id];
        if (!self || !isRadioGroup(self)) return 0;
        const target = state.nodes[self.runtime.targetId];
        if (target && isControl(target)) return target.runtime.value;
        if (target && isVar(target)) return target.runtime.value;
        return 0;
    }

    private get _radios(): ScRadioNode[] {
        try {
            const node = runtimeApi.getById(this.id) as ScRadioGroupNode | undefined;
            return (node?.children ?? []).filter((c): c is ScRadioNode => isRadio(c));
        } catch {
            return [];
        }
    }

    constructor() {
        super();
        this.bind = '';
        this.orientation = 'horizontal';
    }

    private _onSelect(value: number) {
        const targetId = this._runtime?.targetId;
        if (value !== this._state && this.bind && targetId) {
            const target = runtimeApi.getById(targetId);
            if (target && isVar(target)) {
                runtimeApi.setVar({id: targetId, value});
            } else {
                runtimeApi.setControl({id: targetId, value});
            }
        }
    }

    private _renderRadio(r: ScRadioNode, selected: boolean) {
        const w = r.width;
        const h = r.height;
        const fg = r.fgcolor || 'var(--color-primary, #0a6dc4)';
        const bg = r.bgcolor || 'var(--color-bg-secondary, #e8e8e8)';

        if (r.src) {
            const yOff = selected ? -h : 0;
            return html`<img
                width=${w}
                height=${h}
                style="object-fit: none; object-position: 0px ${yOff}px;"
                src=${r.src}
                alt=""
            />`;
        }

        const r2 = Math.min(w, h) * 0.5;
        return html`
            <svg width=${w} height=${h} viewBox="0 0 ${w} ${h}">
                <circle cx=${w * 0.5} cy=${h * 0.5} r=${r2 - 1} fill=${bg} />
                ${selected
                    ? svg`<circle cx=${w * 0.5} cy=${h * 0.5} r=${r2 * 0.45} fill=${fg} />`
                    : ''}
            </svg>
        `;
    }

    render() {
        const current = this._state;
        return html`
            ${this._radios.map(r => html`
                <span class="radio-item" @click=${() => this._onSelect(r.value)}>
                    ${this._renderRadio(r, r.value === current)}
                    ${r.label ? html`<span class="radio-label">${r.label}</span>` : ''}
                </span>
            `)}
        `;
    }
}
