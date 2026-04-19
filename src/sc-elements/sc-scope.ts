import {html, css} from 'lit';
import type {ScScopeItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer, isScope} from '@/lib/utils/guards';
import {bufferManager, type BufferSubscription} from '@/lib/buffers';
import {ScElement} from './internal/sc-element.ts';

interface ScopeState {
    bufferId: string;
    ready: boolean;
}

/**
 * Fallback shot size in samples if `width * 4` is smaller than this. A shot is
 * the unit the scope draws at a time: we accumulate streaming batches into a
 * fill buffer until it reaches this size, then swap it into the display buffer
 * wholesale. Smaller → higher update rate but less audio on screen; larger →
 * lower rate but more cycles visible. 2048 at 48 kHz ≈ 43 ms / ~23 FPS, and
 * matches the recommended plugin-side streaming buffer.
 */
const SHOT_SAMPLES_MIN = 2048;

/**
 * Real-time oscilloscope bound to an `sc-buffer`. Subscribes to the shared
 * `BufferManager` stream for that buffer, accumulates incoming batches into
 * fixed-size shots, and draws each completed shot via requestAnimationFrame.
 *
 * Shot-based design (versus sliding window): each drawn frame is a single
 * contiguous chunk of audio that arrived together. There is no cross-frame
 * state to keep coherent — the trigger search runs fresh on every draw, so
 * consecutive frames phase-lock for stable signals without needing hysteresis.
 *
 * Rendering retained from the original sc-scope:
 * - Rising zero-crossing trigger with sub-sample interpolation.
 * - Sub-pixel linear interpolation along the drawn path.
 * - Retina-aware canvas scaling via devicePixelRatio.
 * - Signal-threshold overlay ("no signal" until peak > 0.01).
 */
export class ScScope extends ScElement<ScScopeItem, ScopeState> {
    static properties = {
        bind: {type: String},
        width: {type: Number},
        height: {type: Number},
        color: {type: String},
    };

    declare bind: string;
    declare width: number;
    declare height: number;
    declare color: string;

    static styles = css`
        :host { display: inline-block; }
        canvas {
            border: 1px solid var(--color-border, #555);
            border-radius: 4px;
            background: var(--color-bg, #111);
        }
    `;

    private _canvas: HTMLCanvasElement | null = null;
    private _ctx: CanvasRenderingContext2D | null = null;
    private _rafId: number | null = null;
    private _dirty = false;

    private _subscription: BufferSubscription | null = null;

    // Two equally-sized buffers. `_display` is what the draw loop reads and is
    // only ever whole-written between draws; `_shot` is the fill target that
    // accumulates incoming batches. On shot completion the two are swapped.
    private _display: Float32Array = new Float32Array(0);
    private _shot: Float32Array = new Float32Array(0);
    private _fillPos = 0;
    private _hasSignal = false;

    private _lineColor = '';
    private _borderColor = '';
    private _textColor = '';

    constructor() {
        super();
        this.bind = '';
        this.width = 200;
        this.height = 100;
        this.color = '';
    }

    getState(state: RuntimeState): ScopeState {
        const empty: ScopeState = {bufferId: '', ready: false};
        const self = state.nodes[this.id];
        if (!self || !isScope(self)) return empty;
        const buf = state.nodes[self.runtime.targetId];
        if (!buf || !isBuffer(buf)) return empty;
        return {
            bufferId: buf.id,
            ready: buf.runtime.loaded && buf.runtime.bufnum > 0,
        };
    }

    protected _sendCreate() {
        super._sendCreate();
        const styles = getComputedStyle(this);
        this._lineColor = this.color || styles.getPropertyValue('--color-primary').trim() || '#00ff00';
        this._borderColor = styles.getPropertyValue('--color-border').trim() || '#555';
        this._textColor = styles.getPropertyValue('--color-text').trim() || '#e0e0e0';
        if (this._state?.ready) this._activate();
    }

    protected _sendDestroy() {
        this._deactivate();
        super._sendDestroy();
    }

    protected _onStateChange(prev: ScopeState, next: ScopeState): void {
        if (next.ready && !prev.ready) {
            this._activate();
        } else if (!next.ready && prev.ready) {
            this._deactivate();
        }
        super._onStateChange(prev, next);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._deactivate();
        if (this._rafId != null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    // ── Subscription lifecycle ────────────────────────────────────────────

    private _activate() {
        if (this._subscription) return;
        const subscription = bufferManager.subscribe(
            this._state.bufferId,
            (samples) => this._onSamples(samples),
        );
        if (!subscription) return;
        subscription.on('idle', this._onStreamIdle);

        const size = Math.max(this.width * 4, SHOT_SAMPLES_MIN);
        if (this._display.length !== size) {
            this._display = new Float32Array(size);
            this._shot = new Float32Array(size);
        }
        this._fillPos = 0;
        this._hasSignal = false;
        this._dirty = true;
        this._subscription = subscription;
    }

    private _deactivate() {
        if (this._subscription) {
            this._subscription.off('idle', this._onStreamIdle);
            this._subscription.close();
            this._subscription = null;
        }
        this._fillPos = 0;
        this._hasSignal = false;
        this._dirty = true;
    }

    /** Stream went quiet (BufferManager deactivated it). Reset display state
     *  to the "no signal" view. The `active` event isn't needed: incoming
     *  samples naturally trigger `_detectSignal` to flip `_hasSignal` back. */
    private _onStreamIdle = () => {
        this._fillPos = 0;
        this._hasSignal = false;
        this._dirty = true;
    };

    private _onSamples(batch: Float32Array) {
        const size = this._shot.length;
        if (size === 0 || batch.length === 0) return;

        let rem = batch;
        while (rem.length > 0) {
            const need = size - this._fillPos;
            const take = Math.min(need, rem.length);
            this._shot.set(rem.subarray(0, take), this._fillPos);
            this._fillPos += take;
            if (this._fillPos === size) {
                // Shot complete — swap with display. Double-buffering ensures
                // the draw loop never sees a half-filled shot.
                const done = this._shot;
                this._shot = this._display;
                this._display = done;
                this._fillPos = 0;
                this._dirty = true;
                this._detectSignal(done);
            }
            rem = rem.subarray(take);
        }
    }

    private _detectSignal(shot: Float32Array) {
        let peak = 0;
        for (let i = 0; i < shot.length; i++) {
            const v = shot[i] < 0 ? -shot[i] : shot[i];
            if (v > peak) peak = v;
        }
        this._hasSignal = peak > 0.01;
    }

    // ── Draw loop ─────────────────────────────────────────────────────────

    firstUpdated() {
        this._canvas = this.renderRoot.querySelector('canvas');
        if (!this._canvas) return;
        this._ctx = this._canvas.getContext('2d');
        this._startDrawLoop();
    }

    private _startDrawLoop() {
        const loop = () => {
            if (this._dirty) {
                this._dirty = false;
                this._draw();
            }
            this._rafId = requestAnimationFrame(loop);
        };
        this._rafId = requestAnimationFrame(loop);
    }

    private _draw() {
        const canvas = this._canvas;
        const ctx = this._ctx;
        if (!canvas || !ctx) return;

        const w = this.width;
        const h = this.height;
        const dpr = window.devicePixelRatio || 1;

        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.scale(dpr, dpr);
        }

        const samples = this._display;
        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = this._borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        if (!this._hasSignal || samples.length === 0) {
            ctx.fillStyle = this._textColor;
            ctx.globalAlpha = 0.4;
            ctx.font = '11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(samples.length === 0 ? 'waiting...' : 'no signal', w / 2, h / 2 - 8);
            ctx.globalAlpha = 1;
            return;
        }

        // Fresh trigger search every draw. We search the first quarter of the
        // shot so the draw has `quarter` samples to the right of the trigger
        // without running off the end — `samples.length / 2` total usage.
        const quarter = samples.length >> 2;
        let trigger = 0;
        let triggerFrac = 0;

        for (let i = 1; i < quarter; i++) {
            if (samples[i - 1] <= 0 && samples[i] > 0) { trigger = i; break; }
        }

        if (trigger > 0) {
            const s0 = samples[trigger - 1];
            const s1 = samples[trigger];
            if (s1 !== s0) {
                triggerFrac = -s0 / (s1 - s0);
            }
            triggerFrac = (trigger - 1) + triggerFrac;
        }

        const step = quarter / w;
        const halfH = h / 2;

        ctx.strokeStyle = this._lineColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < w; i++) {
            const fIdx = i * step + triggerFrac;
            const idx = fIdx | 0;
            const frac = fIdx - idx;
            const s0 = samples[idx];
            const s1 = samples[idx + 1] ?? s0;
            const y = (1 - (s0 + (s1 - s0) * frac)) * halfH;
            if (i === 0) ctx.moveTo(0, y);
            else ctx.lineTo(i, y);
        }
        ctx.stroke();
    }

    render() {
        return html`<canvas></canvas>`;
    }
}
