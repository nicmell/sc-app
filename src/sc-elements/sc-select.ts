import {html, css} from 'lit';
import type {ScSelectNode, ScOptionNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isSelect, isControl, isVar, isOption} from '@/lib/utils/guards';
import {ScElement} from './internal/sc-element.ts';

export class ScSelect extends ScElement<ScSelectNode, number> {
    static properties = {
        bind: {type: String},
    };

    declare bind: string;

    static styles = css`
        :host { display: inline-block; }
    `;

    getState(state: RuntimeState): number {
        const self = state.nodes[this.id];
        if (!self || !isSelect(self)) return 0;
        const target = state.nodes[self.runtime.targetId];
        if (target && isControl(target)) return target.runtime.value;
        if (target && isVar(target)) return target.runtime.value;
        return 0;
    }

    private get _options(): ScOptionNode[] {
        try {
            const node = runtimeApi.getById(this.id) as ScSelectNode | undefined;
            return (node?.children ?? []).filter((c): c is ScOptionNode => isOption(c));
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
            const targetId = this._runtime.targetId;
            const target = runtimeApi.getById(targetId);
            if (target && isVar(target)) {
                runtimeApi.setVar({id: targetId, value});
            } else {
                runtimeApi.setControl({id: targetId, value});
            }
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
