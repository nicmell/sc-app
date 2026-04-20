import {html, svg, css} from 'lit';
import type {ScRunItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isRun, isNode} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {ScElement} from './internal/sc-element.ts';

export class ScRun extends ScElement<ScRunItem, number> {
    static properties = {
        size: {type: Number},
        src: {type: String},
        bind: {type: String},
        fgcolor: {type: String},
        bgcolor: {type: String},
    };

    declare size: number;
    declare src: string;
    declare bind: string;
    declare fgcolor: string;
    declare bgcolor: string;

    static styles = css`
        :host { display: inline-block; cursor: pointer; user-select: none; }
        button {
            all: unset;
            display: block;
            cursor: pointer;
        }
        svg { display: block; pointer-events: none; }
        img { display: block; pointer-events: none; }
    `;

    getState(state: RuntimeState): number {
        const self = state.nodes[this.id];
        if (!self || !isRun(self)) return 1;
        const node = state.nodes[self.runtime.targetId];
        return node && isNode(node) ? node.runtime.run : 1;
    }

    get run(): boolean {
        return this._state !== 0;
    }

    constructor() {
        super();
        this.size = 24;
        this.src = '';
        this.bind = '';
        this.fgcolor = 'var(--color-primary, #0a6dc4)';
        this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
    }

    private _onClick = () => {
        const targetId = this._runtime.targetId;
        const node = runtimeApi.getById(targetId);
        if (!node || !isNode(node)) return;
        const value = this.run ? 0 : 1;
        oscService.setNodeRun(node.runtime.nodeId, value);
        runtimeApi.setRunning({nodeId: targetId, value});
    };

    render() {
        const s = this.size;
        const run = this.run;

        if (this.src) {
            const yOff = run ? -s : 0;
            return html`<button @click=${this._onClick}>
                <img
                    width=${s}
                    height=${s}
                    style="object-fit: none; object-position: 0px ${yOff}px;"
                    src=${this.src}
                    alt=""
                />
            </button>`;
        }

        const r = s * 0.15;
        const icon = run
            ? svg`<rect x=${s * 0.3} y=${s * 0.25} width=${s * 0.15} height=${s * 0.5} rx="1" fill=${this.fgcolor} />
                  <rect x=${s * 0.55} y=${s * 0.25} width=${s * 0.15} height=${s * 0.5} rx="1" fill=${this.fgcolor} />`
            : svg`<polygon points="${s * 0.35},${s * 0.25} ${s * 0.35},${s * 0.75} ${s * 0.72},${s * 0.5}" fill=${this.fgcolor} />`;

        return html`<button @click=${this._onClick}>
            <svg width=${s} height=${s} viewBox="0 0 ${s} ${s}">
                <rect width=${s} height=${s} rx=${r} ry=${r} fill=${this.bgcolor} />
                ${icon}
            </svg>
        </button>`;
    }
}
