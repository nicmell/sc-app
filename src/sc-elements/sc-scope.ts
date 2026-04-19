import {html, css} from 'lit';
import type {ScScopeItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer, isScope} from '@/lib/utils/guards';
import {bufferManager, type BufferStream} from '@/lib/buffers';
import {ScElement} from './internal/sc-element.ts';

interface ScopeState {
    bufferId: string;
    ready: boolean;
}

/** Fallback display window in samples if `width * 4` is smaller than this. */
const DISPLAY_SAMPLES_MIN = 512;

/**
 * Real-time oscilloscope bound to an `sc-buffer`. Subscribes to the shared
 * `BufferManager` stream for that buffer, keeps a rolling window of the most
 * recent samples, and draws a trigger-aligned waveform via requestAnimationFrame.
 *
 * Key rendering details retained from the original implementation:
 * - Rising zero-crossing trigger with ±8-sample hysteresis for stable phase.
 * - Sub-sample trigger interpolation + linear inter-pixel interpolation.
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

    private _subscription: {stream: BufferStream; handler: (samples: Float32Array) => void} | null = null;
    private _display: Float32Array = new Float32Array(0);
    private _hasSignal = false;
    private _lastTrigger = 0;

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
        if (this._state?.ready) void this._activate();
    }

    protected _sendDestroy() {
        this._deactivate();
        super._sendDestroy();
    }

    protected _onStateChange(prev: ScopeState, next: ScopeState): void {
        if (next.ready && !prev.ready) {
            void this._activate();
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

    private async _activate() {
        if (this._subscription) return;
        const stream = bufferManager.getBuffer(this._state.bufferId);
        if (!stream) return;

        const displaySize = Math.max(this.width * 4, DISPLAY_SAMPLES_MIN);
        if (this._display.length !== displaySize) {
            this._display = new Float32Array(displaySize);
        }
        this._hasSignal = false;
        this._lastTrigger = 0;
        this._dirty = true;

        const handler = (samples: Float32Array) => this._onSamples(samples);
        stream.on('message', handler);
        if (!stream.isOpen) await stream.open();
        this._subscription = {stream, handler};
    }

    private _deactivate() {
        if (this._subscription) {
            this._subscription.stream.off('message', this._subscription.handler);
            this._subscription = null;
        }
        this._hasSignal = false;
        this._lastTrigger = 0;
        this._dirty = true;
    }

    private _onSamples(batch: Float32Array) {
        const display = this._display;
        const n = display.length;
        const b = batch.length;
        if (n === 0 || b === 0) return;

        // Slide the display window: drop the oldest `b` samples, append `batch`.
        // If the batch is larger than the display, keep only its last `n` samples.
        if (b >= n) {
            display.set(batch.subarray(b - n));
        } else {
            display.copyWithin(0, b, n);
            display.set(batch, n - b);
        }
        this._dirty = true;

        if (!this._hasSignal) {
            let peak = 0;
            for (let i = 0; i < b; i++) {
                const v = batch[i] < 0 ? -batch[i] : batch[i];
                if (v > peak) { peak = v; if (peak > 0.01) break; }
            }
            if (peak > 0.01) this._hasSignal = true;
        }
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

        if (!this._hasSignal) {
            ctx.fillStyle = this._textColor;
            ctx.globalAlpha = 0.4;
            ctx.font = '11px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(samples.length === 0 ? 'waiting...' : 'no signal', w / 2, h / 2 - 8);
            ctx.globalAlpha = 1;
            return;
        }

        // Trigger: rising zero-crossing with sub-sample interpolation.
        // Search only the first quarter of the window so the draw has room on
        // the right side without running off the buffer.
        const quarter = samples.length >> 2;
        let trigger = 0;
        let triggerFrac = 0;
        const HYSTERESIS = 8;

        if (this._lastTrigger > 0) {
            const lo = Math.max(1, this._lastTrigger - HYSTERESIS);
            const hi = Math.min(quarter, this._lastTrigger + HYSTERESIS);
            for (let i = lo; i < hi; i++) {
                if (samples[i - 1] <= 0 && samples[i] > 0) { trigger = i; break; }
            }
        }

        if (trigger === 0) {
            for (let i = 1; i < quarter; i++) {
                if (samples[i - 1] <= 0 && samples[i] > 0) { trigger = i; break; }
            }
        }

        if (trigger > 0) {
            const s0 = samples[trigger - 1];
            const s1 = samples[trigger];
            if (s1 !== s0) {
                triggerFrac = -s0 / (s1 - s0);
            }
            triggerFrac = (trigger - 1) + triggerFrac;
        }

        this._lastTrigger = trigger;

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
