import {html, svg, css, LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext} from './context.ts';

export class ScRun extends LitElement {
    static properties = {
        run: {type: Boolean, reflect: true},
        size: {type: Number},
        src: {type: String},
        fgcolor: {type: String},
        bgcolor: {type: String},
    };

    declare run: boolean;
    declare size: number;
    declare src: string;
    declare fgcolor: string;
    declare bgcolor: string;

    private _node = new ContextConsumer(this, {context: nodeContext, subscribe: true});

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

    constructor() {
        super();
        this.run = false;
        this.size = 24;
        this.src = '';
        this.fgcolor = 'var(--color-primary, #0a6dc4)';
        this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
    }

    private _onClick = () => {
        this.run = !this.run;
        this._node.value?.onRun(this.run);
    };

    render() {
        const s = this.size;

        if (this.src) {
            const yOff = this.run ? -s : 0;
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
        const icon = this.run
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
