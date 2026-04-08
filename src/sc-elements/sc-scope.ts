import {html, css} from 'lit';
import type {ScScopeItem, ScBufferItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {bufGetnMessage} from '@/lib/osc/messages.ts';
import {runtimeApi} from '@/lib/stores/api';
import {ScElement} from './internal/sc-element.ts';

const GETN_CHUNK = 1024;
const FRAME_INTERVAL = 1000 / 30; // ~30fps

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
        console.log('[sc-scope] _sendCreate, starting polling');
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

    private _startPolling() {
        this._stopPolling();
        this._lastFrameTime = 0;
        this._tick(performance.now());
    }

    private _stopPolling() {
        if (this._rafId) {
            cancelAnimationFrame(this._rafId);
            this._rafId = 0;
        }
    }

    private _tick = (now: number) => {
        this._rafId = requestAnimationFrame(this._tick);
        if (now - this._lastFrameTime < FRAME_INTERVAL) return;
        this._lastFrameTime = now;
        this._poll();
    };

    private async _poll() {
        if (this._reading) return;
        const buf = this._getBuffer();
        if (!buf || !buf.runtime.loaded) return;

        this._reading = true;
        try {
            const totalSamples = buf.frames * buf.channels;
            const samples = await this._readBuffer(buf.runtime.bufnum, totalSamples);
            if (samples.length > 0) this._samples = samples;
        } catch (e) {
            // ignore — retry on next tick
        } finally {
            this._reading = false;
            this._draw();
        }
    }

    private async _readBuffer(bufnum: number, totalSamples: number): Promise<Float32Array> {
        const result = new Float32Array(totalSamples);
        for (let offset = 0; offset < totalSamples; offset += GETN_CHUNK) {
            const count = Math.min(GETN_CHUNK, totalSamples - offset);
            const chunk = await this._readChunk(bufnum, offset, count);
            result.set(chunk, offset);
        }
        return result;
    }

    private _readChunk(bufnum: number, start: number, count: number): Promise<Float32Array> {
        return new Promise((resolve) => {
            let done = false;
            const cleanup = () => { if (!done) { done = true; oscService.off('*', subId); } };

            const subId = oscService.on('*', (...args: unknown[]) => {
                const msg = args[0] as { address: string; args: unknown[] };
                if (msg?.address === '/fail') { cleanup(); resolve(new Float32Array(0)); return; }
                if (msg?.address !== '/b_setn') return;
                const [buf, s, c, ...data] = msg.args as [number, number, number, ...number[]];
                if (buf !== bufnum || s !== start) return;
                cleanup();
                resolve(new Float32Array(data.slice(0, c)));
            });

            // Timeout fallback
            setTimeout(() => { cleanup(); resolve(new Float32Array(0)); }, 2000);

            oscService.send(bufGetnMessage(bufnum, start, count));
        });
    }

    private _draw() {
        const canvas = this.renderRoot.querySelector('canvas') as HTMLCanvasElement | null;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const w = this.width;
        const h = this.height;
        const dpr = window.devicePixelRatio || 1;

        // Scale canvas for retina
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            ctx.scale(dpr, dpr);
        }

        const samples = this._samples;
        const nonZero = samples.length > 0 && samples.some(v => v !== 0);

        ctx.clearRect(0, 0, w, h);

        const styles = getComputedStyle(this);
        const lineColor = this.color || styles.getPropertyValue('--color-primary').trim() || '#00ff00';
        const borderColor = styles.getPropertyValue('--color-border').trim() || '#555';
        const textColor = styles.getPropertyValue('--color-text').trim() || '#e0e0e0';

        // Center line
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();

        if (!nonZero) {
            ctx.fillStyle = textColor;
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

        ctx.strokeStyle = lineColor;
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
