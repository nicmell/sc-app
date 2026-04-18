import {html, svg, css} from 'lit';
import type {ScRecordItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer, isRecord} from '@/lib/utils/guards';
import {optionsApi, rootApi} from '@/lib/stores/api';
import {oscService} from '@/lib/osc';
import {createBufferStream, type BufferStream} from '@/lib/bufferStream/BufferStream';
import {ScElement} from './internal/sc-element.ts';

const STREAM_CHUNK = 1024;
const GETN_CHUNK = 256;
const READ_TIMEOUT_MS = 3000;

interface RecordState {
    bufnum: number;
    loaded: boolean;
    frames: number;
    channels: number;
}

export class ScRecord extends ScElement<ScRecordItem, RecordState> {
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
        _hasFrozen: {state: true},
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
    declare _hasFrozen: boolean;

    static styles = css`
        :host { display: inline-block; user-select: none; }
        .toolbar { display: flex; gap: 6px; align-items: center; margin-bottom: 4px; }
        button {
            all: unset;
            display: block;
            cursor: pointer;
        }
        button[disabled] { cursor: not-allowed; opacity: 0.4; }
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
    private _frozen: Float32Array | null = null;
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
        this._hasFrozen = false;
    }

    getState(state: RuntimeState): RecordState {
        const self = state.nodes[this.id];
        if (!self || !isRecord(self)) return {bufnum: 0, loaded: false, frames: 0, channels: 1};
        const buf = state.nodes[self.runtime.targetId];
        if (!buf || !isBuffer(buf)) return {bufnum: 0, loaded: false, frames: 0, channels: 1};
        return {
            bufnum: buf.runtime.bufnum,
            loaded: buf.runtime.loaded,
            frames: buf.runtime.frames,
            channels: buf.runtime.channels,
        };
    }

    protected _onStateChange(prev: RecordState, next: RecordState): void {
        // Buffer disappeared mid-record: stop cleanly.
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
            console.warn('sc-record: sample rate unknown (not connected?)');
            return;
        }

        const initialCap = Math.max(1, Math.ceil(this.window * sampleRate));
        this._captured = new Float32Array(initialCap);
        this._capturedLen = 0;
        this._frozen = null;
        this._hasFrozen = false;
        this._scrollSample = 0;
        this._sampleRate = sampleRate;
        this._zoomWindow = 0; // reset to authored window
        this._autoScroll = true;
        this._recording = true;
        this._dirty = true;

        const {host, port} = optionsApi.scsynth;
        const stream = createBufferStream({
            bufnum: s.bufnum,
            frames: s.frames,
            chunk: STREAM_CHUNK,
            scsynthAddr: `${host}:${port}`,
        });
        stream.onTick((samples) => this._appendSamples(samples));
        this._stream = stream;
        try {
            await stream.open();
        } catch (e) {
            console.error('sc-record: stream open failed', e);
            this._stream = null;
            this._recording = false;
        }
    }

    private async _stopRecording(): Promise<void> {
        if (this._stream) {
            this._stream.close();
            this._stream = null;
        }
        this._recording = false;
        this._autoScroll = false;

        const s = this._state;
        if (!s.loaded || s.bufnum <= 0 || s.frames <= 0) {
            this._dirty = true;
            return;
        }

        this._busy = true;
        try {
            const frozen = await this._readFullBuffer(s.bufnum, s.frames);
            this._frozen = frozen;
            this._hasFrozen = true;
            this._scrollSample = 0;
        } catch (e) {
            console.error('sc-record: full-buffer read failed', e);
        } finally {
            this._busy = false;
            this._dirty = true;
        }
    }

    // ── Live streaming tick ─────────────────────────────────────────────────

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

    // ── Sample-accurate full-buffer read via chunked /b_getn ───────────────

    private _readFullBuffer(bufnum: number, frames: number): Promise<Float32Array> {
        const out = new Float32Array(frames);
        const chunks: Array<{start: number; count: number}> = [];
        for (let offset = 0; offset < frames; offset += GETN_CHUNK) {
            chunks.push({start: offset, count: Math.min(GETN_CHUNK, frames - offset)});
        }
        const pending = new Set(chunks.map(c => c.start));

        return new Promise<Float32Array>((resolve) => {
            const subId = oscService.on('*', (...args: unknown[]) => {
                const msg = args[0] as {address: string; args: unknown[]} | undefined;
                if (!msg || msg.address !== '/b_setn') return;
                const [b, start, count, ...values] = msg.args as [number, number, number, ...number[]];
                if (b !== bufnum || !pending.has(start)) return;
                const end = Math.min(frames, start + count);
                for (let i = 0; i < end - start && i < values.length; i++) {
                    out[start + i] = values[i];
                }
                pending.delete(start);
                if (pending.size === 0) {
                    clearTimeout(timeout);
                    oscService.off('*', subId);
                    resolve(out);
                }
            });
            const timeout = setTimeout(() => {
                oscService.off('*', subId);
                resolve(out); // resolve with partial data
            }, READ_TIMEOUT_MS);
            for (const c of chunks) {
                oscService.readBuffer(bufnum, c.start, c.count);
            }
        });
    }

    // ── Download ───────────────────────────────────────────────────────────

    private _onDownloadClick = () => {
        if (!this._frozen || this._recording) return;
        const blob = encodeWav(this._frozen, this._sampleRate);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `record-${stamp}.wav`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

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
        if (!this._recording && this._frozen) return this._frozen;
        if (this._capturedLen > 0) return this._captured.subarray(0, this._capturedLen);
        return null;
    }

    private _viewLength(): number {
        if (!this._recording && this._frozen) return this._frozen.length;
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

        ctx.strokeStyle = border;
        ctx.beginPath();
        ctx.moveTo(0, h / 2 + 0.5);
        ctx.lineTo(w, h / 2 + 0.5);
        ctx.stroke();

        const samples = this._viewSamples();
        if (!samples || this._sampleRate <= 0) return;

        const samplesPerCol = (this._effectiveWindow() * this._sampleRate) / w;
        const len = this._viewLength();
        const mid = h / 2;

        ctx.strokeStyle = fg;
        ctx.lineWidth = 1;
        ctx.beginPath();
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
            ctx.moveTo(x + 0.5, yMax);
            ctx.lineTo(x + 0.5, Math.max(yMax + 1, yMin));
        }
        ctx.stroke();
    }

    // ── Scroll interaction (idle only) ─────────────────────────────────────

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

        // Positive deltaY (scroll down) → zoom out; negative → zoom in.
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
        const canDownload = this._hasFrozen && !this._recording && !this._busy;
        return html`
            <div class="toolbar">
                ${this._recordButton(canRecord)}
                ${this._downloadButton(canDownload)}
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

    private _downloadButton(enabled: boolean) {
        const s = this.size;
        const r = s * 0.15;
        // Arrow into tray
        const arrowColor = this.fgcolor;
        return html`<button
            title="Download WAV"
            ?disabled=${!enabled}
            @click=${this._onDownloadClick}>
            <svg width=${s} height=${s} viewBox="0 0 ${s} ${s}">
                <rect width=${s} height=${s} rx=${r} ry=${r} fill=${this.bgcolor} />
                <path
                    d="M ${s * 0.5} ${s * 0.25}
                       L ${s * 0.5} ${s * 0.62}
                       M ${s * 0.33} ${s * 0.48}
                       L ${s * 0.5} ${s * 0.65}
                       L ${s * 0.67} ${s * 0.48}
                       M ${s * 0.28} ${s * 0.75}
                       L ${s * 0.72} ${s * 0.75}"
                    stroke=${arrowColor}
                    stroke-width=${Math.max(1, s * 0.08)}
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    fill="none" />
            </svg>
        </button>`;
    }
}

// ── WAV encoder (inline; IEEE float32, mono) ───────────────────────────────

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
    const numFrames = samples.length;
    const bytesPerSample = 4;
    const dataBytes = numFrames * bytesPerSample;
    const buf = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buf);

    const writeStr = (o: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);        // PCM-style header size
    view.setUint16(20, 3, true);         // format = IEEE float
    view.setUint16(22, 1, true);         // channels
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 32, true);        // bit depth
    writeStr(36, 'data');
    view.setUint32(40, dataBytes, true);

    for (let i = 0; i < numFrames; i++) {
        view.setFloat32(44 + i * 4, samples[i], true);
    }
    return new Blob([buf], {type: 'audio/wav'});
}
