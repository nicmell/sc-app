import {html, css} from 'lit';
import type {ScRecordItem, ScBufferItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {bufGetnMessage} from '@/lib/osc/messages.ts';
import {runtimeApi} from '@/lib/stores/api';
import {encodeWav} from '@/lib/utils/wav';
import {ScElement} from './internal/sc-element.ts';

const GETN_CHUNK = 1024;

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}

export class ScRecord extends ScElement<ScRecordItem, number> {
    static properties = {
        bind: {type: String},
        label: {type: String},
        _recording: {state: true},
        _reading: {state: true},
        _dataUrl: {state: true},
    };

    declare bind: string;
    declare label: string;
    declare _recording: boolean;
    declare _reading: boolean;
    declare _dataUrl: string;

    static styles = css`
        :host { display: inline-block; }
        .container { display: flex; align-items: center; gap: 8px; }
        button {
            all: unset;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border: 1px solid var(--color-border, #555);
            border-radius: 4px;
            background: var(--color-surface, #2a2a2a);
            color: var(--color-text, #e0e0e0);
            cursor: pointer;
            user-select: none;
            font-family: system-ui, sans-serif;
            font-size: 12px;
        }
        button:hover { border-color: var(--color-primary, #0a6dc4); }
        button[data-recording] { border-color: #e57373; color: #e57373; }
        .indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #888;
        }
        .indicator[data-active] {
            background: #e57373;
            animation: pulse 1s infinite;
        }
        audio { height: 24px; }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
        }
    `;

    constructor() {
        super();
        this.bind = '';
        this.label = 'Record';
        this._recording = false;
        this._reading = false;
        this._dataUrl = '';
    }

    getState(state: RuntimeState): number {
        const self = state.nodes[this.id];
        if (!self || self.type !== 'sc-record') return 0;
        const buf = state.nodes[self.runtime.targetId];
        return buf && isBuffer(buf) ? buf.runtime.bufnum : 0;
    }

    private _getBuffer(): ScBufferItem | undefined {
        const rt = this._runtime;
        if (!rt) return undefined;
        const buf = runtimeApi.getById(rt.targetId);
        return buf && isBuffer(buf) ? buf : undefined;
    }

    private _onClick = async () => {
        if (this._recording) {
            this._recording = false;
            await this._readBack();
        } else {
            const buf = this._getBuffer();
            if (!buf || !buf.runtime.loaded) return;
            this._recording = true;
            this._dataUrl = '';
        }
    };

    private async _readBack() {
        const buf = this._getBuffer();
        if (!buf) return;

        this._reading = true;
        try {
            const totalSamples = buf.frames * buf.channels;
            const samples = await this._readBuffer(buf.runtime.bufnum, totalSamples);
            const blob = encodeWav(samples, 44100, buf.channels);
            this._dataUrl = await blobToDataUrl(blob);
        } finally {
            this._reading = false;
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
            const subId = oscService.on('*', (...args: unknown[]) => {
                const msg = args[0] as { address: string; args: unknown[] };
                if (msg?.address !== '/b_setn') return;
                const [buf, s, c, ...data] = msg.args as [number, number, number, ...number[]];
                if (buf !== bufnum || s !== start) return;
                oscService.off('*', subId);
                resolve(new Float32Array(data.slice(0, c)));
            });
            oscService.send(bufGetnMessage(bufnum, start, count));
        });
    }

    render() {
        return html`
            <div class="container">
                <button
                    ?data-recording=${this._recording}
                    ?disabled=${this._reading}
                    @click=${this._onClick}>
                    <span class="indicator" ?data-active=${this._recording}></span>
                    ${this._recording ? 'Stop' : this._reading ? 'Reading...' : this.label}
                </button>
                ${this._dataUrl ? html`
                    <audio controls src=${this._dataUrl}></audio>
                ` : ''}
            </div>
        `;
    }
}
