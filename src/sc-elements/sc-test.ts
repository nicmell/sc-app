import {html, css} from 'lit';
import type {ScTestItem, UGenSpec} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isNode, isTest} from '@/lib/utils/guards';
import {compileSynthDef} from '@/lib/synthdef';
import {createBufferStream, type BufferStream} from '@/lib/buffers';
import {oscService} from '@/lib/osc';
import {optionsApi, rootApi} from '@/lib/stores/api';
import {ScElement} from './internal/sc-element.ts';

// ── Shared recorder synthdef ──────────────────────────────────────────────

const RECORDER_SYNTHDEF_NAME = '__sc_test_rec__';
let recorderBytes: number[] | null = null;

/**
 * Build (once) and send the self-contained recorder synthdef. Uses
 * `Phasor.ar` to drive `BufWr.ar` (instead of `RecordBuf.ar`) so the write
 * head position is explicit and can be reported to the client via
 * `SendTrig.kr`, tagged with `bufnum`. The Rust reader picks those /tr
 * messages up and anchors its read positions safely behind the actual
 * write head — eliminating the "read straddles writer" artefact that
 * plain cyclic polling is vulnerable to.
 *
 * The Phasor's `end` is hardcoded to `TEST_FRAMES` since the recorder
 * always allocates a private buffer of that exact size.
 *
 * Compiled bytes are cached module-wide (compilation is deterministic),
 * but `/d_recv` is re-sent on every activation so we never assume scsynth
 * retained the synthdef across a server restart, a client reconnect, or
 * an earlier failure. `/d_recv` is idempotent on scsynth — duplicates
 * just replace the existing def — so the extra traffic is harmless.
 */
function sendRecorderSynthdef(): Promise<void> {
    if (!recorderBytes) {
        const specs = new Map<string, UGenSpec>([
            ['read',    {name: 'read',    type: 'In',        rate: 'ar', inputs: {bus: 'bus', numChannels: '1'}}],
            ['phase',   {name: 'phase',   type: 'Phasor',    rate: 'ar', inputs: {trig: '0', rate: '1', start: '0', end: String(TEST_FRAMES), resetPos: '0'}}],
            ['write',   {name: 'write',   type: 'BufWr',     rate: 'ar', inputs: {inputArray: 'read', bufnum: 'bufnum', phase: 'phase', loop: '1'}}],
            ['phaseKr', {name: 'phaseKr', type: 'A2K',       rate: 'kr', inputs: {in: 'phase'}}],
            ['tick',    {name: 'tick',    type: 'Impulse',   rate: 'kr', inputs: {freq: '200', phase: '0'}}],
            ['reply',   {name: 'reply',   type: 'SendTrig',  rate: 'kr', inputs: {in: 'tick', id: 'bufnum', value: 'phaseKr'}}],
        ]);
        recorderBytes = compileSynthDef(RECORDER_SYNTHDEF_NAME, {bus: 0, bufnum: 0}, specs);
    }
    return oscService.sendSynthDef(Uint8Array.from(recorderBytes));
}

// ── Component ─────────────────────────────────────────────────────────────

interface TestState {
    parentRunning: boolean;
}

/** Generous buffer sizing: `frames = chunks × chunk`, 8192 frames split into
 *  4 × 2048 keeps the reader-head inside a 50%-wide safe zone relative to
 *  the writer head — the in-read "kink" artefact we were hunting. */
const TEST_FRAMES = 8192;
const TEST_CHUNKS = 4;
const TEST_CHUNK_SAMPLES = TEST_FRAMES / TEST_CHUNKS;

/** Shot window for the scope display. Match the chunk size so each drawn
 *  frame corresponds to exactly one `/b_getn` response — no within-shot
 *  concatenation across multiple reads. */
const SHOT_SAMPLES = TEST_CHUNK_SAMPLES;

/**
 * Self-contained oscilloscope: given a bus number, `sc-test` compiles a
 * private recorder synthdef (once per session), allocates a private buffer,
 * and spawns a synth that reads the bus into that buffer via `RecordBuf`.
 * Renders the buffer with the same shot-based trigger-aligned draw as
 * `sc-scope`, but the plugin author doesn't touch buffers or RecordBuf at all
 * — just wires audio out to the bus.
 */
export class ScTest extends ScElement<ScTestItem, TestState> {
    static properties = {
        bus: {type: Number},
        channels: {type: Number},
        width: {type: Number},
        height: {type: Number},
        color: {type: String},
    };

    declare bus: number;
    declare channels: number;
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
    private _activating = false;
    private _bufnum = 0;
    private _synthNodeId = 0;

    private _display: Float32Array = new Float32Array(SHOT_SAMPLES);
    private _shot: Float32Array = new Float32Array(SHOT_SAMPLES);
    private _fillPos = 0;
    private _hasSignal = false;

    private _lineColor = '';
    private _borderColor = '';
    private _textColor = '';

    constructor() {
        super();
        this.bus = 0;
        this.channels = 1;
        this.width = 200;
        this.height = 100;
        this.color = '';
    }

    getState(state: RuntimeState): TestState {
        const self = state.nodes[this.id];
        if (!self || !isTest(self)) return {parentRunning: false};
        // Walk ancestors upward; if any NodeRuntime along the chain has run=0,
        // the audio graph above sc-test is paused and our recorder synth
        // should not be active either.
        let id = self.runtime.parentId;
        while (id) {
            const node = state.nodes[id];
            if (!node) return {parentRunning: false};
            if (isNode(node)) {
                if (!node.runtime.loaded || !node.runtime.run) return {parentRunning: false};
            }
            id = node.runtime.parentId;
        }
        return {parentRunning: true};
    }

    protected _sendCreate() {
        super._sendCreate();
        const styles = getComputedStyle(this);
        this._lineColor = this.color || styles.getPropertyValue('--color-primary').trim() || '#00ff00';
        this._borderColor = styles.getPropertyValue('--color-border').trim() || '#555';
        this._textColor = styles.getPropertyValue('--color-text').trim() || '#e0e0e0';
        if (this._state?.parentRunning) void this._activate();
    }

    protected _sendDestroy() {
        this._deactivate();
        super._sendDestroy();
    }

    protected _onStateChange(prev: TestState, next: TestState): void {
        const wasRunning = !!prev && prev.parentRunning;
        if (next.parentRunning && !wasRunning) {
            void this._activate();
        } else if (!next.parentRunning && wasRunning) {
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
        // Re-entry guard: _onStateChange can fire again while we're awaiting
        // the synthdef-load delay / stream open, before `_subscription` is
        // populated — that would otherwise produce duplicate buffers + synths.
        if (this._subscription || this._activating) return;
        this._activating = true;

        try {
            const sampleRate = rootApi.serverStatus.sampleRate;
            if (sampleRate <= 0) return;

            // Wait for /d_recv to reach scsynth and be processed before the
            // /s_new below — otherwise scsynth sees "SynthDef not found".
            await sendRecorderSynthdef();

            const bufnum = oscService.nextBufNum();
            const nodeId = oscService.nextNodeId();
            const groupId = this._parent?.runtime.nodeId ?? oscService.defaultGroupId();

            // Private buffer + recorder synth: allocBuffer and createSynth
            // both await scsynth confirmation, so the BufferStream opened
            // below can safely start polling /b_getn immediately. We don't
            // dispatch any runtimeApi.* action — these server-side resources
            // are outside the plugin element tree.
            await oscService.allocBuffer(bufnum, TEST_FRAMES, 1);
            this._bufnum = bufnum;
            await oscService.createSynth(RECORDER_SYNTHDEF_NAME, nodeId, groupId, {
                bus: this.bus,
                bufnum,
            }, true);
            this._synthNodeId = nodeId;

            const {host, port} = optionsApi.scsynth;
            const stream = createBufferStream({
                bufnum,
                frames: TEST_FRAMES,
                chunk: TEST_CHUNK_SAMPLES,
                sampleRate: Math.round(sampleRate),
                scsynthAddr: `${host}:${port}`,
            });

            this._resetVisualState();
            const handler = (samples: Float32Array) => this._onSamples(samples);
            stream.on('message', handler);
            await stream.open();
            this._subscription = {stream, handler};
        } finally {
            this._activating = false;
        }
    }

    private _deactivate() {
        if (this._subscription) {
            this._subscription.stream.off('message', this._subscription.handler);
            this._subscription.stream.close();
            this._subscription = null;
        }
        if (this._synthNodeId > 0) {
            void oscService.freeSynth(this._synthNodeId);
            this._synthNodeId = 0;
        }
        if (this._bufnum > 0) {
            void oscService.freeBuffer(this._bufnum);
            this._bufnum = 0;
        }
        this._resetVisualState();
    }

    private _resetVisualState() {
        this._fillPos = 0;
        this._hasSignal = false;
        this._dirty = true;
    }

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
            const v = Math.abs(shot[i]);
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

        const quarter = samples.length >> 2;
        let trigger = 0;
        let triggerFrac = 0;

        for (let i = 1; i < quarter; i++) {
            if (samples[i - 1] <= 0 && samples[i] > 0) { trigger = i; break; }
        }

        if (trigger > 0) {
            const s0 = samples[trigger - 1];
            const s1 = samples[trigger];
            if (s1 !== s0) triggerFrac = -s0 / (s1 - s0);
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
