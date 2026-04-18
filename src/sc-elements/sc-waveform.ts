import {html, svg, css} from 'lit';
import type {ScWaveformItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer, isWaveform} from '@/lib/utils/guards';
import {optionsApi, rootApi} from '@/lib/stores/api';
import {createBufferStream, type BufferStream} from '@/lib/streams/BufferStream';
import {ScElement} from './internal/sc-element.ts';

/**
 * Cap on samples per `/b_getn` request. The Rust reader runs a wall-clock
 * catch-up loop keyed to the buffer's sample rate and issues as many requests
 * as needed each tick; this just bounds UDP payload size.
 */
const STREAM_CHUNK = 1024;

interface WaveformState {
    bufnum: number;
    loaded: boolean;
    frames: number;
    channels: number;
}

/**
 * In-memory waveform track: polls the bound `sc-buffer` via `/b_getn` while
 * recording and keeps every sample in a Float32Array. No file is written, no
 * download is offered — the captured samples live purely in the component
 * and are thrown away on disconnect.
 */
export class ScWaveform extends ScElement<ScWaveformItem, WaveformState> {
    static properties = {
        bind: {type: String},
        width: {type: Number},
        height: {type: Number},
        window: {type: Number},
        size: {type: Number},
        fgcolor: {type: String},
        bgcolor: {type: String},
        _recording: {state: true},
        _busy: {state: true},
    };

    declare bind: string;
    declare width: number;
    declare height: number;
    declare window: number;
    declare size: number;
    declare fgcolor: string;
    declare bgcolor: string;
    declare _recording: boolean;
    declare _busy: boolean;

    static styles = css`
        :host { display: inline-block; user-select: none; }
        .toolbar { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
        button {
            all: unset;
            display: block;
            cursor: pointer;
        }
        button[disabled] {
            cursor: not-allowed;
            opacity: 0.4;
            pointer-events: none;
        }
        svg { display: block; pointer-events: none; }
        canvas {
            display: block;
            background: var(--color-bg, #111);
            border: 1px solid var(--color-border, #444);
            cursor: grab;
            touch-action: none;
        }
        canvas:active { cursor: grabbing; }
    `;

    private _canvas: HTMLCanvasElement | null = null;
    private _ctx: CanvasRenderingContext2D | null = null;
    private _rafId: number | null = null;
    private _dirty = true;

    private _stream: BufferStream | null = null;
    private _captured: Float32Array = new Float32Array(0);
    private _capturedLen = 0;
    private _sampleRate = 0;
    private _scrollSample = 0;
    private _autoScroll = false;
    private _zoomWindow = 0; // 0 = fall back to `this.window`

    constructor() {
        super();
        this.bind = '';
        this.width = 320;
        this.height = 96;
        this.window = 5;
        this.size = 24;
        this.fgcolor = 'var(--color-primary, #0a6dc4)';
        this.bgcolor = 'var(--color-bg-secondary, #e8e8e8)';
        this._recording = false;
        this._busy = false;
    }

    getState(state: RuntimeState): WaveformState {
        const empty: WaveformState = {bufnum: 0, loaded: false, frames: 0, channels: 1};
        const self = state.nodes[this.id];
        if (!self || !isWaveform(self)) return empty;
        const buf = state.nodes[self.runtime.targetId];
        if (!buf || !isBuffer(buf)) return empty;
        return {
            bufnum: buf.runtime.bufnum,
            loaded: buf.runtime.loaded,
            frames: buf.runtime.frames,
            channels: buf.runtime.channels,
        };
    }

    protected _onStateChange(prev: WaveformState, next: WaveformState): void {
        if (this._recording && (!next.loaded || next.bufnum <= 0)) {
            void this._stopRecording();
        }
        super._onStateChange(prev, next);
    }

    protected _sendDestroy() {
        super._sendDestroy();
        if (this._recording) void this._stopRecording();
    }

    // ── Record / stop ─────────────────────────────────────────────────────

    private _onRecordClick = () => {
        if (this._busy) return;
        if (this._recording) {
            void this._stopRecording();
        } else {
            void this._startRecording();
        }
    };

    private async _startRecording(): Promise<void> {
        const s = this._state;
        if (!s.loaded || s.bufnum <= 0) return;

        const sampleRate = rootApi.serverStatus.sampleRate;
        if (sampleRate <= 0) {
            console.warn('sc-waveform: sample rate unknown (not connected?)');
            return;
        }

        this._busy = true;
        try {
            const initialCap = Math.max(1, Math.ceil(Math.max(60, this.window) * sampleRate));
            this._captured = new Float32Array(initialCap);
            this._capturedLen = 0;
            this._scrollSample = 0;
            this._sampleRate = sampleRate;
            this._zoomWindow = 0;
            this._autoScroll = true;
            this._dirty = true;

            const {host, port} = optionsApi.scsynth;
            const stream = createBufferStream({
                bufnum: s.bufnum,
                frames: s.frames,
                chunk: STREAM_CHUNK,
                sampleRate: Math.round(sampleRate),
                scsynthAddr: `${host}:${port}`,
            });
            stream.onSamples((samples) => this._appendSamples(samples));
            await stream.open();
            this._stream = stream;
            this._recording = true;
        } catch (e) {
            console.error('sc-waveform: start failed', e);
        } finally {
            this._busy = false;
        }
    }

    private async _stopRecording(): Promise<void> {
        this._recording = false;
        this._autoScroll = false;

        if (this._stream) {
            this._stream.close();
            this._stream = null;
        }
        this._dirty = true;
    }

    // ── Live tail tick ─────────────────────────────────────────────────────

    private _appendSamples(samples: Float32Array): void {
        const needed = this._capturedLen + samples.length;
        if (needed > this._captured.length) {
            let cap = this._captured.length || 1;
            while (cap < needed) cap *= 2;
            const grown = new Float32Array(cap);
            grown.set(this._captured.subarray(0, this._capturedLen));
            this._captured = grown;
        }
        this._captured.set(samples, this._capturedLen);
        this._capturedLen += samples.length;

        if (this._autoScroll) {
            const visible = Math.round(this._effectiveWindow() * this._sampleRate);
            this._scrollSample = Math.max(0, this._capturedLen - visible);
        }
        this._dirty = true;
    }

    private _effectiveWindow(): number {
        return this._zoomWindow > 0 ? this._zoomWindow : this.window;
    }

    // ── Waveform drawing ───────────────────────────────────────────────────

    firstUpdated() {
        this._canvas = this.renderRoot.querySelector('canvas');
        if (!this._canvas) return;
        this._ctx = this._canvas.getContext('2d');
        this._canvas.addEventListener('pointerdown', this._onPointerDown);
        this._canvas.addEventListener('wheel', this._onWheel, {passive: false});
        this._startDrawLoop();
    }

    private _startDrawLoop() {
        const draw = () => {
            if (this._dirty) {
                this._draw();
                this._dirty = false;
            }
            this._rafId = requestAnimationFrame(draw);
        };
        this._rafId = requestAnimationFrame(draw);
    }

    private _viewSamples(): Float32Array | null {
        if (this._capturedLen > 0) return this._captured.subarray(0, this._capturedLen);
        return null;
    }

    private _viewLength(): number {
        return this._capturedLen;
    }

    private _draw() {
        const ctx = this._ctx;
        if (!ctx) return;
        const w = this.width;
        const h = this.height;
        ctx.clearRect(0, 0, w, h);

        const cs = getComputedStyle(this);
        const fg = cs.getPropertyValue('--color-primary').trim() || '#0a6dc4';
        const border = cs.getPropertyValue('--color-border').trim() || '#444';

        // Centre line.
        ctx.fillStyle = border;
        ctx.fillRect(0, Math.floor(h / 2), w, 1);

        const samples = this._viewSamples();
        if (!samples || this._sampleRate <= 0) return;

        const samplesPerCol = (this._effectiveWindow() * this._sampleRate) / w;
        const len = this._viewLength();
        const mid = h / 2;

        ctx.fillStyle = fg;
        for (let x = 0; x < w; x++) {
            const s0 = Math.floor(this._scrollSample + x * samplesPerCol);
            const s1 = Math.floor(this._scrollSample + (x + 1) * samplesPerCol);
            if (s0 >= len) break;
            const end = Math.min(s1, len);
            if (end <= s0) continue;
            let min = 1, max = -1;
            for (let i = s0; i < end; i++) {
                const v = samples[i];
                if (v < min) min = v;
                if (v > max) max = v;
            }
            if (min > max) continue;
            const yMax = mid - max * (h / 2 - 1);
            const yMin = mid - min * (h / 2 - 1);
            const barTop = Math.min(yMax, yMin);
            const barHeight = Math.max(1, Math.abs(yMin - yMax));
            ctx.fillRect(x, barTop, 1, barHeight);
        }
    }

    // ── Scroll + zoom (idle only) ─────────────────────────────────────────

    private _maxScroll(): number {
        const len = this._viewLength();
        if (this._sampleRate <= 0) return 0;
        const visible = Math.round(this._effectiveWindow() * this._sampleRate);
        return Math.max(0, len - visible);
    }

    private _clampWindow(w: number): number {
        if (this._sampleRate <= 0) return w;
        const minW = this.width / this._sampleRate; // 1 sample per pixel
        const len = this._viewLength();
        const captureWin = len > 0 ? len / this._sampleRate : this.window;
        const maxW = Math.max(this.window, captureWin);
        return Math.max(minW, Math.min(maxW, w));
    }

    private _clampScroll(s: number): number {
        return Math.max(0, Math.min(this._maxScroll(), s));
    }

    private _onPointerDown = (e: PointerEvent) => {
        if (this._recording) return;
        if (!this._canvas) return;
        e.preventDefault();
        this._canvas.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startScroll = this._scrollSample;
        const samplesPerPx = (this._effectiveWindow() * this._sampleRate) / this.width;
        const onMove = (me: PointerEvent) => {
            const dx = me.clientX - startX;
            this._scrollSample = this._clampScroll(startScroll - dx * samplesPerPx);
            this._dirty = true;
        };
        const onUp = (ue: PointerEvent) => {
            this._canvas?.releasePointerCapture(ue.pointerId);
            this._canvas?.removeEventListener('pointermove', onMove);
            this._canvas?.removeEventListener('pointerup', onUp);
            this._canvas?.removeEventListener('pointercancel', onUp);
        };
        this._canvas.addEventListener('pointermove', onMove);
        this._canvas.addEventListener('pointerup', onUp);
        this._canvas.addEventListener('pointercancel', onUp);
    };

    private _onWheel = (e: WheelEvent) => {
        if (this._recording || !this._canvas) return;
        e.preventDefault();

        const rect = this._canvas.getBoundingClientRect();
        const cursorX = Math.max(0, Math.min(this.width, e.clientX - rect.left));

        const winBefore = this._effectiveWindow();
        const sppBefore = (winBefore * this._sampleRate) / this.width;
        const anchorSample = this._scrollSample + cursorX * sppBefore;

        const factor = Math.pow(1.15, (e.deltaY || 0) / 100);
        const winAfter = this._clampWindow(winBefore * factor);
        this._zoomWindow = winAfter;

        const sppAfter = (winAfter * this._sampleRate) / this.width;
        this._scrollSample = this._clampScroll(anchorSample - cursorX * sppAfter);
        this._dirty = true;
    };

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._rafId != null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        if (this._stream) {
            this._stream.close();
            this._stream = null;
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────

    render() {
        const bufferReady = this._state.loaded && this._state.bufnum > 0;
        const canRecord = bufferReady && !this._busy;
        return html`
            <div class="toolbar">
                ${this._recordButton(canRecord)}
            </div>
            <canvas width=${this.width} height=${this.height}></canvas>
        `;
    }

    private _recordButton(enabled: boolean) {
        const s = this.size;
        const r = s * 0.15;
        const accent = '#e57373';
        const icon = this._recording
            ? svg`<rect x=${s * 0.35} y=${s * 0.35} width=${s * 0.3} height=${s * 0.3} fill=${accent} />`
            : svg`<circle cx=${s / 2} cy=${s / 2} r=${s * 0.3} fill=${accent} />`;
        return html`<button
            title=${this._recording ? 'Stop' : 'Record'}
            ?disabled=${!enabled}
            @click=${this._onRecordClick}>
            <svg width=${s} height=${s} viewBox="0 0 ${s} ${s}">
                <rect width=${s} height=${s} rx=${r} ry=${r} fill=${this.bgcolor} />
                ${icon}
            </svg>
        </button>`;
    }
}
