import {IS_TAURI} from '@/lib/env';

export type TickHandler = (samples: Float32Array) => void;

export interface RecordingHandle {
    id: string;
    path: string;
}

export interface RecordingTail {
    open(): Promise<void>;
    close(): void;
    onSamples(cb: TickHandler): void;
}

export async function openRecording(): Promise<RecordingHandle> {
    if (IS_TAURI) {
        const {invoke} = await import('@tauri-apps/api/core');
        return invoke<RecordingHandle>('record_open');
    }
    const resp = await fetch('/recording', {method: 'POST'});
    if (!resp.ok) throw new Error(`record open failed: ${resp.status}`);
    return resp.json();
}

export async function readRecording(id: string): Promise<Blob> {
    if (IS_TAURI) {
        const {invoke} = await import('@tauri-apps/api/core');
        const bytes = await invoke<number[]>('record_read', {id});
        return new Blob([new Uint8Array(bytes)], {type: 'audio/wav'});
    }
    const resp = await fetch(`/recording/${encodeURIComponent(id)}.wav`);
    if (!resp.ok) throw new Error(`record read failed: ${resp.status}`);
    return resp.blob();
}

export async function cleanupRecording(id: string): Promise<void> {
    if (IS_TAURI) {
        const {invoke} = await import('@tauri-apps/api/core');
        await invoke('record_cleanup', {id});
        return;
    }
    await fetch(`/recording/${encodeURIComponent(id)}`, {method: 'DELETE'});
}

class TauriChannelTail implements RecordingTail {
    private cb: TickHandler = () => {};
    private closed = false;

    constructor(private id: string) {}

    onSamples(cb: TickHandler) {
        this.cb = cb;
    }

    async open() {
        const {invoke, Channel} = await import('@tauri-apps/api/core');
        const channel = new Channel<number[]>();
        channel.onmessage = (samples) => {
            if (!this.closed) this.cb(Float32Array.from(samples));
        };
        await invoke('record_tail_start', {id: this.id, channel});
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        void import('@tauri-apps/api/core').then(({invoke}) =>
            invoke('record_tail_stop', {id: this.id}),
        );
    }
}

class WebSocketTail implements RecordingTail {
    private cb: TickHandler = () => {};
    private ws: WebSocket | null = null;
    private closed = false;

    constructor(private id: string) {}

    onSamples(cb: TickHandler) {
        this.cb = cb;
    }

    async open() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(
            `${proto}//${location.host}/recording/${encodeURIComponent(this.id)}/tail`,
        );
        ws.binaryType = 'arraybuffer';
        this.ws = ws;
        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error('Recording WS error'));
        });
        ws.onmessage = (ev) => {
            if (this.closed) return;
            const data = ev.data as ArrayBuffer;
            if (data.byteLength < 4) return;
            const view = new DataView(data);
            const n = view.getUint32(0, true);
            if (data.byteLength < 4 + n * 4) return;
            const samples = new Float32Array(data, 4, n);
            this.cb(samples);
        };
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        this.ws?.close();
        this.ws = null;
    }
}

export function createRecordingTail(id: string): RecordingTail {
    return IS_TAURI ? new TauriChannelTail(id) : new WebSocketTail(id);
}
