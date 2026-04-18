import {html, css} from 'lit';
import FFT from 'fft.js';
import type {ScRecordItem, ScBufferItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer, isRecord} from '@/lib/utils/guards';
import {runtimeApi, optionsApi} from '@/lib/stores/api';
import {createBufferStream, type BufferStream} from '@/lib/bufferStream/BufferStream';
import {ScElement} from './internal/sc-element.ts';

const FFT_SIZE = 1024;
const HOP = 512;
const CHUNK = 1024;
const DB_FLOOR = -80;

interface RecordState {
    bufnum: number;
    loaded: boolean;
    frames: number;
}

export class ScRecord extends ScElement<ScRecordItem, RecordState> {
    static properties = {
        bind: {type: String},
        width: {type: Number},
        height: {type: Number},
    };

    declare bind: string;
    declare width: number;
    declare height: number;

    static styles = css`
        :host { display: inline-block; }
        canvas { display: block; background: #000; image-rendering: pixelated; }
    `;

    private _canvas: HTMLCanvasElement | null = null;
    private _ctx: CanvasRenderingContext2D | null = null;
    private _offscreen: HTMLCanvasElement | null = null;
    private _offCtx: CanvasRenderingContext2D | null = null;
    private _dirty = false;
    private _rafId: number | null = null;

    private _stream: BufferStream | null = null;

    private _fft: FFT | null = null;
    private _fftOut: Float32Array | null = null;
    private _window: Float32Array | null = null;
    private _ring: Float32Array = new Float32Array(0);
    private _writePos = 0;
    private _readPos = 0;
    private _available = 0;

    constructor() {
        super();
        this.bind = '';
        this.width = 320;
        this.height = 128;
    }

    getState(state: RuntimeState): RecordState {
        const self = state.nodes[this.id];
        if (!self || !isRecord(self)) return {bufnum: 0, loaded: false, frames: 0};
        const buf = state.nodes[self.runtime.targetId];
        if (!buf || !isBuffer(buf)) return {bufnum: 0, loaded: false, frames: 0};
        return {bufnum: buf.runtime.bufnum, loaded: buf.runtime.loaded, frames: buf.runtime.frames};
    }

    protected _onStateChange(prev: RecordState, next: RecordState): void {
        if (prev.loaded !== next.loaded || prev.bufnum !== next.bufnum) {
            this._closeStream();
            if (next.loaded && next.bufnum > 0 && this._loaded) {
                void this._openStream(next);
            }
        }
        super._onStateChange(prev, next);
    }

    protected _sendCreate() {
        super._sendCreate();
        const s = this._state;
        if (s.loaded && s.bufnum > 0) {
            void this._openStream(s);
        }
    }

    protected _sendDestroy() {
        super._sendDestroy();
        this._closeStream();
    }

    private _getBuffer(): ScBufferItem | undefined {
        const rt = runtimeApi.getById(this.id);
        if (!rt || !isRecord(rt)) return undefined;
        const buf = runtimeApi.getById(rt.runtime.targetId);
        return buf && isBuffer(buf) ? buf : undefined;
    }

    private async _openStream(s: RecordState): Promise<void> {
        if (this._stream) return;
        const buf = this._getBuffer();
        if (!buf) return;
        const {host, port} = optionsApi.scsynth;
        const stream = createBufferStream({
            bufnum: s.bufnum,
            frames: s.frames,
            chunk: CHUNK,
            scsynthAddr: `${host}:${port}`,
        });
        stream.onTick((samples) => this._consume(samples));
        this._stream = stream;
        try {
            await stream.open();
        } catch (e) {
            console.error('sc-record stream open failed', e);
            this._stream = null;
        }
    }

    private _closeStream() {
        this._stream?.close();
        this._stream = null;
        this._resetRing();
    }

    private _initFft() {
        if (this._fft) return;
        this._fft = new FFT(FFT_SIZE);
        this._fftOut = new Float32Array(FFT_SIZE * 2);
        this._window = new Float32Array(FFT_SIZE);
        for (let i = 0; i < FFT_SIZE; i++) {
            this._window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1)));
        }
        this._ring = new Float32Array(FFT_SIZE * 4);
    }

    private _resetRing() {
        this._writePos = 0;
        this._readPos = 0;
        this._available = 0;
    }

    private _consume(samples: Float32Array) {
        this._initFft();
        const cap = this._ring.length;
        for (let i = 0; i < samples.length; i++) {
            this._ring[this._writePos] = samples[i];
            this._writePos = (this._writePos + 1) % cap;
            if (this._available < cap) {
                this._available++;
            } else {
                this._readPos = (this._readPos + 1) % cap;
            }
        }
        while (this._available >= FFT_SIZE) {
            this._emitColumn();
            const advance = Math.min(HOP, this._available);
            this._readPos = (this._readPos + advance) % cap;
            this._available -= advance;
        }
    }

    private _emitColumn() {
        if (!this._fft || !this._fftOut || !this._window || !this._offCtx || !this._offscreen) return;
        const frame = new Float32Array(FFT_SIZE);
        const cap = this._ring.length;
        for (let i = 0; i < FFT_SIZE; i++) {
            frame[i] = this._ring[(this._readPos + i) % cap] * this._window[i];
        }
        this._fft.realTransform(this._fftOut, frame);
        this._fft.completeSpectrum(this._fftOut);

        const bins = FFT_SIZE / 2;
        const h = this._offscreen.height;
        const img = this._offCtx.createImageData(1, h);
        for (let y = 0; y < h; y++) {
            // Flip so low freq at bottom; map y=0 (top) = highest bin.
            const binIdx = Math.floor(((h - 1 - y) / (h - 1)) * (bins - 1));
            const re = this._fftOut[2 * binIdx];
            const im = this._fftOut[2 * binIdx + 1];
            const mag = Math.hypot(re, im) / FFT_SIZE;
            const db = 20 * Math.log10(mag + 1e-9);
            const norm = Math.max(0, Math.min(1, (db - DB_FLOOR) / -DB_FLOOR));
            const [r, g, b] = hslToRgb(240 * (1 - norm), 1, 0.1 + 0.4 * norm);
            const off = y * 4;
            img.data[off] = r;
            img.data[off + 1] = g;
            img.data[off + 2] = b;
            img.data[off + 3] = 255;
        }

        const w = this._offscreen.width;
        this._offCtx.globalCompositeOperation = 'copy';
        this._offCtx.drawImage(this._offscreen, -1, 0);
        this._offCtx.globalCompositeOperation = 'source-over';
        this._offCtx.putImageData(img, w - 1, 0);
        this._dirty = true;
    }

    firstUpdated() {
        this._canvas = this.renderRoot.querySelector('canvas');
        if (!this._canvas) return;
        this._ctx = this._canvas.getContext('2d');
        this._offscreen = document.createElement('canvas');
        this._offscreen.width = this.width;
        this._offscreen.height = this.height;
        this._offCtx = this._offscreen.getContext('2d');
        if (this._offCtx) {
            this._offCtx.fillStyle = '#000';
            this._offCtx.fillRect(0, 0, this.width, this.height);
        }
        this._startDrawLoop();
    }

    private _startDrawLoop() {
        const draw = () => {
            if (this._dirty && this._ctx && this._offscreen) {
                this._ctx.drawImage(this._offscreen, 0, 0);
                this._dirty = false;
            }
            this._rafId = requestAnimationFrame(draw);
        };
        this._rafId = requestAnimationFrame(draw);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._rafId != null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._closeStream();
    }

    render() {
        return html`<canvas width=${this.width} height=${this.height}></canvas>`;
    }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (hp < 1) { r = c; g = x; }
    else if (hp < 2) { r = x; g = c; }
    else if (hp < 3) { g = c; b = x; }
    else if (hp < 4) { g = x; b = c; }
    else if (hp < 5) { r = x; b = c; }
    else { r = c; b = x; }
    const m = l - c / 2;
    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255),
    ];
}
