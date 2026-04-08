import {html, css} from 'lit';
import type {ScScopeItem, ScBufferItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {bufGetnMessage} from '@/lib/osc/messages.ts';
import {runtimeApi} from '@/lib/stores/api';
import {ScElement} from './internal/sc-element.ts';

const FRAME_INTERVAL = 1000 / 30;

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
    private _lastFrameTime = 0;
    private _samples: Float32Array = new Float32Array(0);
    private _reading = false;
    private _canvas: HTMLCanvasElement | null = null;
    private _ctx: CanvasRenderingContext2D | null = null;
    private _lineColor = '';
    private _borderColor = '';
    private _textColor = '';
    private _listenerId = 0;
    private _pendingResolve: ((data: Float32Array) => void) | null = null;
    private _pendingBufnum = 0;
    private _pendingStart = 0;
    private _hasSignal = false;

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
        this._cacheStyles();
        this._startPolling();
    }

    protected _sendDestroy() {
        this._stopPolling();
        super._sendDestroy();
    }

    disconnectedCallback() {
        this._stopPolling();
        super.disconnectedCallback();
    }

    private _cacheStyles() {
        const styles = getComputedStyle(this);
        this._lineColor = this.color || styles.getPropertyValue('--color-primary').trim() || '#00ff00';
        this._borderColor = styles.getPropertyValue('--color-border').trim() || '#555';
        this._textColor = styles.getPropertyValue('--color-text').trim() || '#e0e0e0';
    }

    private _startPolling() {
        this._stopPolling();
        this._lastFrameTime = 0;

        // Single persistent listener for /b_setn responses
        this._listenerId = oscService.on('*', (...args: unknown[]) => {
            if (!this._pendingResolve) return;
            const msg = args[0] as { address: string; args: unknown[] };
            if (msg?.address === '/fail') {
                this._pendingResolve(new Float32Array(0));
                this._pendingResolve = null;
                return;
            }
            if (msg?.address !== '/b_setn') return;
            const [buf, s, , ...data] = msg.args as [number, number, number, ...number[]];
            if (buf !== this._pendingBufnum || s !== this._pendingStart) return;
            this._pendingResolve(new Float32Array(data));
            this._pendingResolve = null;
        });

        this._tick(performance.now());
    }

    private _stopPolling() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = 0;
        }
        if (this._listenerId) {
            oscService.off('*', this._listenerId);
            this._listenerId = 0;
        }
        this._pendingResolve = null;
    }

    private _tick = (now: number) => {
        this._rafId = requestAnimationFrame(this._tick);
        if (now - this._lastFrameTime < FRAME_INTERVAL) return;
        this._lastFrameTime = now;
        this._poll();
    };

    private async _poll() {
        if (this._reading) return;
        if (!this._parent?.runtime.run) return;
        const buf = this._getBuffer();
        if (!buf || !buf.runtime.loaded) return;

        this._reading = true;
        try {
            const totalSamples = buf.frames * buf.channels;

            // Reuse buffer if size matches
            if (this._samples.length !== totalSamples) {
                this._samples = new Float32Array(totalSamples);
            }

            // Single request — read entire buffer at once (up to ~16K samples fits in UDP)
            const data = await this._readAll(buf.runtime.bufnum, totalSamples);
            if (data.length > 0) {
                this._samples.set(data);
                if (!this._hasSignal) this._hasSignal = data.some(v => v !== 0);
            }
        } catch {
            // ignore — retry on next tick
        } finally {
            this._reading = false;
            this._draw();
        }
    }

    private _readAll(bufnum: number, count: number): Promise<Float32Array> {
        return new Promise((resolve) => {
            this._pendingBufnum = bufnum;
            this._pendingStart = 0;
            this._pendingResolve = resolve;
            oscService.send(bufGetnMessage(bufnum, 0, count));
        });
    }

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

        // Scale canvas for retina (once)
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.scale(dpr, dpr);
        }

        const samples = this._samples;
        ctx.clearRect(0, 0, w, h);

        // Center line
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

        // Trigger: find a rising zero-crossing in the first quarter to stabilize display
        const quarter = Math.floor(samples.length / 4);
        let trigger = 0;
        for (let i = 1; i < quarter; i++) {
            if (samples[i - 1] <= 0 && samples[i] > 0) { trigger = i; break; }
        }

        // Draw one quarter of the buffer starting from the trigger point
        const displayLen = quarter;
        const step = displayLen / w;

        ctx.strokeStyle = this._lineColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < w; i++) {
            const fIdx = i * step;
            const idx = Math.floor(fIdx);
            const frac = fIdx - idx;
            const s0 = samples[trigger + idx] ?? 0;
            const s1 = samples[trigger + idx + 1] ?? s0;
            const val = s0 + (s1 - s0) * frac;
            const y = (1 - val) * h / 2;
            if (i === 0) ctx.moveTo(i, y);
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
