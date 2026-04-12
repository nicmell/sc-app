/**
 * sc-scope — Real-time oscilloscope bound to an sc-buffer.
 *
 * ## Data transport
 *
 * Uses ScopeChannel from `@/lib/socket` which abstracts the platform:
 *   - Tauri: scope_bind/scope_unbind + scope-data events (push from Rust)
 *   - Browser: /scope WebSocket with binary f32 request/response
 *
 * ## Architecture: push data + rAF draw loop
 *
 *   - Data arrives via ScopeChannel callback → writes back buffer, swaps, sets dirty.
 *   - Draw loop: requestAnimationFrame, draws only when dirty.
 *
 * ## Optimizations
 *
 *   1. Reads only `width * 4` samples, not the full buffer.
 *   2. Binary WebSocket in browser — 4 bytes per float, zero JSON overhead.
 *   3. Double-buffer swap: draw loop never sees partially-written data.
 *   4. _dirty flag: draw loop skips no-op frames.
 *   5. Canvas, context, styles cached — no per-frame DOM queries.
 *   6. Float32Array reused (allocated only on size change).
 *   7. Retina: canvas scaled by devicePixelRatio once.
 *   8. Signal threshold: suppressed until peak > 0.01.
 *   9. Sub-sample trigger interpolation for stable phase alignment.
 *  10. Trigger hysteresis: ±8 samples around last crossing.
 *  11. Linear interpolation for smooth sub-pixel rendering.
 */
import {html, css} from 'lit';
import type {ScScopeItem, ScBufferItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer} from '@/lib/utils/guards';
import {optionsApi, runtimeApi} from '@/lib/stores/api';
import {BinaryChannel} from '@/lib/socket';
import {ScElement} from './internal/sc-element.ts';

export class ScScope extends ScElement<ScScopeItem, number> {
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

    private _rafId = 0;
    private _samples: Float32Array = new Float32Array(0);
    private _backBuffer: Float32Array = new Float32Array(0);
    private _dirty = false;
    private _canvas: HTMLCanvasElement | null = null;
    private _ctx: CanvasRenderingContext2D | null = null;
    private _lineColor = '';
    private _borderColor = '';
    private _textColor = '';
    private _hasSignal = false;
    private _active = false;
    private _lastTrigger = 0;
    private _channel: BinaryChannel | null = null;

    static styles = css`
        :host { display: inline-block; }
        canvas {
            border: 1px solid var(--color-border, #555);
            border-radius: 4px;
            background: var(--color-bg, #111);
        }
    `;

    constructor() {
        super();
        this.bind = '';
        this.width = 200;
        this.height = 100;
        this.color = '';
    }

    getState(state: RuntimeState): number {
        const self = state.nodes[this.id];
        if (!self || self.type !== 'sc-scope') return 0;
        const buf = state.nodes[self.runtime.targetId];
        return buf && isBuffer(buf) ? buf.runtime.bufnum : 0;
    }

    private _getBuffer(): ScBufferItem | undefined {
        const rt = this._runtime;
        if (!rt) return undefined;
        const buf = runtimeApi.getById(rt.targetId);
        return buf && isBuffer(buf) ? buf : undefined;
    }

    protected _sendCreate() {
        super._sendCreate();
        const styles = getComputedStyle(this);
        this._lineColor = this.color || styles.getPropertyValue('--color-primary').trim() || '#00ff00';
        this._borderColor = styles.getPropertyValue('--color-border').trim() || '#555';
        this._textColor = styles.getPropertyValue('--color-text').trim() || '#e0e0e0';
        this._start();
    }

    protected _sendDestroy() {
        this._stop();
        super._sendDestroy();
    }

    disconnectedCallback() {
        this._stop();
        super.disconnectedCallback();
    }

    private _start() {
        this._stop();
        this._active = true;
        this._rafId = requestAnimationFrame(this._drawLoop);
        this._monitorLoop();
    }

    private _stop() {
        this._active = false;
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = 0;
        }
        if (this._channel) {
            this._channel.unbind();
            this._channel = null;
        }
    }

    private _createChannel(bufnum: number, count: number): BinaryChannel {
        const {host, port} = optionsApi.scsynth;
        const req = new ArrayBuffer(8);
        const view = new DataView(req);
        view.setInt32(0, bufnum, true);
        view.setInt32(4, count, true);

        return new BinaryChannel({
            tauriCommand: 'scope_bind',
            tauriUnbindCommand: 'scope_unbind',
            tauriEvent: 'scope-data',
            tauriArgs: {target: `${host}:${port}`, bufnum, count},
            wsPath: '/scope',
            wsRequest: () => {
                // Return a fresh copy each time (WS may transfer the buffer)
                const copy = new ArrayBuffer(8);
                new Uint8Array(copy).set(new Uint8Array(req));
                return copy;
            },
        });
    }

    /** Monitor buffer/parent state and bind/unbind the channel accordingly. */
    private async _monitorLoop() {
        while (this._active) {
            if (!this._parent?.runtime.run) {
                if (this._channel) {
                    await this._channel.unbind();
                    this._channel = null;
                }
                if (this._hasSignal) {
                    this._hasSignal = false;
                    this._lastTrigger = 0;
                    this._dirty = true;
                }
                await new Promise(r => setTimeout(r, 200));
                continue;
            }

            const buf = this._getBuffer();
            if (!buf || !buf.runtime.loaded) {
                if (this._channel) {
                    await this._channel.unbind();
                    this._channel = null;
                }
                await new Promise(r => setTimeout(r, 100));
                continue;
            }

            if (!this._channel) {
                const count = Math.min(this.width * 4, buf.frames * buf.channels);
                this._channel = this._createChannel(buf.runtime.bufnum, count);
                this._channel.onData((floats) => this._onScopeData(floats));
                await this._channel.bind();
            }

            await new Promise(r => setTimeout(r, 200));
        }
    }

    private _onScopeData(floats: ArrayLike<number>) {
        const readSamples = floats.length;
        if (readSamples === 0) return;

        if (this._backBuffer.length !== readSamples) {
            this._backBuffer = new Float32Array(readSamples);
        }
        if (this._samples.length !== readSamples) {
            this._samples = new Float32Array(readSamples);
        }

        for (let i = 0; i < readSamples; i++) this._backBuffer[i] = floats[i];

        const tmp = this._samples;
        this._samples = this._backBuffer;
        this._backBuffer = tmp;
        this._dirty = true;

        if (!this._hasSignal) {
            let peak = 0;
            const s = this._samples;
            for (let i = 0; i < s.length; i++) {
                const v = s[i] < 0 ? -s[i] : s[i];
                if (v > peak) { peak = v; if (peak > 0.01) break; }
            }
            if (peak > 0.01) this._hasSignal = true;
        }
    }

    // --- Draw ---

    private _drawLoop = () => {
        if (!this._active) return;
        this._rafId = requestAnimationFrame(this._drawLoop);
        if (this._dirty) {
            this._dirty = false;
            this._draw();
        }
    };

    private _draw() {
        if (!this._canvas) {
            this._canvas = this.renderRoot.querySelector('canvas') as HTMLCanvasElement | null;
            if (!this._canvas) return;
        }
        if (!this._ctx) {
            this._ctx = this._canvas.getContext('2d');
            if (!this._ctx) return;
        }

        const canvas = this._canvas;
        const ctx = this._ctx;
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

        const samples = this._samples;
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

        // Trigger: rising zero-crossing with sub-sample interpolation
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

    protected firstUpdated() {
        this._draw();
    }

    render() {
        return html`<canvas></canvas>`;
    }
}
