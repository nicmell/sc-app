import {html, css, svg, LitElement} from 'lit';

// White key note indices within an octave (C=0, D=2, E=4, F=5, G=7, A=9, B=11)
const WHITE_NOTES = [0, 2, 4, 5, 7, 9, 11];
// Black key note indices (C#=1, D#=3, F#=6, G#=8, A#=10)
const BLACK_NOTES = [1, 3, 6, 8, 10];
// Black key x-offsets relative to octave start (fraction of white key width)
const BLACK_OFFSETS = [0.7, 1.7, 3.7, 4.7, 5.7];

function midiToHz(note: number): number {
    return 440 * Math.pow(2, (note - 69) / 12);
}

export class ScKeyboard extends LitElement {
    static properties = {
        onChange: {attribute: false},
        onOctaveChange: {attribute: false},
        octaves: {type: Number},
        octave: {type: Number},
        activeNote: {type: Number},
        width: {type: Number},
        keyHeight: {type: Number},
    };

    declare onChange: (hz: number) => void;
    declare onOctaveChange: (octave: number) => void;
    declare octaves: number;
    declare octave: number;
    declare activeNote: number;
    declare width: number;
    declare keyHeight: number;

    private _pressed = false;

    static styles = css`
        :host {
            display: inline-block;
            user-select: none;
            touch-action: none;
        }
        .keyboard-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
        }
        .octave-selector {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-family: system-ui, sans-serif;
        }
        .octave-btn {
            cursor: pointer;
            background: var(--color-surface, #f0f0f0);
            border: 1px solid var(--color-border, #ccc);
            border-radius: 3px;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            line-height: 1;
            color: var(--color-text, #333);
        }
        .octave-btn:hover {
            background: var(--color-surface-active, #e0e0e0);
        }
        .octave-btn[disabled] {
            opacity: 0.3;
            cursor: default;
        }
        .octave-label {
            color: var(--color-text, #333);
            min-width: 20px;
            text-align: center;
        }
        .white-key {
            fill: #fff;
            stroke: #999;
            stroke-width: 1;
            cursor: pointer;
        }
        .white-key:hover {
            fill: #f0f0f0;
        }
        .white-key.active {
            fill: var(--color-primary, #0a6dc4);
        }
        .black-key {
            fill: #333;
            stroke: #000;
            stroke-width: 1;
            cursor: pointer;
        }
        .black-key:hover {
            fill: #555;
        }
        .black-key.active {
            fill: var(--color-primary, #0a6dc4);
        }
    `;

    constructor() {
        super();
        this.onChange = () => {};
        this.onOctaveChange = () => {};
        this.octaves = 2;
        this.octave = 4;
        this.activeNote = -1;
        this.width = 280;
        this.keyHeight = 120;
    }

    private _onPointerDown(midiNote: number, e: PointerEvent) {
        e.preventDefault();
        this._pressed = true;
        (e.target as Element).setPointerCapture?.(e.pointerId);
        this.onChange(midiToHz(midiNote));
    }

    private _onPointerUp = (e: PointerEvent) => {
        e.preventDefault();
        if (this._pressed) {
            this._pressed = false;
            this.onChange(0);
        }
    };

    private _onPointerLeave = (e: PointerEvent) => {
        e.preventDefault();
        if (this._pressed) {
            this._pressed = false;
            this.onChange(0);
        }
    };

    render() {
        const totalWhiteKeys = this.octaves * 7;
        const whiteKeyWidth = this.width / totalWhiteKeys;
        const blackKeyWidth = whiteKeyWidth * 0.6;
        const blackKeyHeight = this.keyHeight * 0.6;
        const svgHeight = this.keyHeight;

        const whiteKeys = [];
        const blackKeys = [];

        for (let oct = 0; oct < this.octaves; oct++) {
            const baseNote = (this.octave + 1 + oct) * 12;
            const octOffset = oct * 7 * whiteKeyWidth;

            for (let i = 0; i < WHITE_NOTES.length; i++) {
                const midi = baseNote + WHITE_NOTES[i];
                const x = octOffset + i * whiteKeyWidth;
                whiteKeys.push(svg`
                    <rect
                        class="white-key ${midi === this.activeNote ? 'active' : ''}"
                        x=${x} y=${0}
                        width=${whiteKeyWidth} height=${this.keyHeight}
                        @pointerdown=${(e: PointerEvent) => this._onPointerDown(midi, e)}
                        @pointerup=${this._onPointerUp}
                        @pointerleave=${this._onPointerLeave}
                    />
                `);
            }

            for (let i = 0; i < BLACK_NOTES.length; i++) {
                const midi = baseNote + BLACK_NOTES[i];
                const x = octOffset + BLACK_OFFSETS[i] * whiteKeyWidth - blackKeyWidth / 2;
                blackKeys.push(svg`
                    <rect
                        class="black-key ${midi === this.activeNote ? 'active' : ''}"
                        x=${x} y=${0}
                        width=${blackKeyWidth} height=${blackKeyHeight}
                        @pointerdown=${(e: PointerEvent) => this._onPointerDown(midi, e)}
                        @pointerup=${this._onPointerUp}
                        @pointerleave=${this._onPointerLeave}
                    />
                `);
            }
        }

        return html`
            <div class="keyboard-container">
                <div class="octave-selector">
                    <button class="octave-btn"
                        ?disabled=${this.octave <= 0}
                        @click=${() => this.octave > 0 && this.onOctaveChange(this.octave - 1)}
                    >&lt;</button>
                    <span class="octave-label">C${this.octave}</span>
                    <button class="octave-btn"
                        ?disabled=${this.octave + this.octaves > 8}
                        @click=${() => this.octave + this.octaves <= 8 && this.onOctaveChange(this.octave + 1)}
                    >&gt;</button>
                </div>
                <svg width=${this.width} height=${svgHeight} viewBox="0 0 ${this.width} ${svgHeight}">
                    ${whiteKeys}
                    ${blackKeys}
                </svg>
            </div>
        `;
    }
}

customElements.define('sc-keyboard', ScKeyboard);
