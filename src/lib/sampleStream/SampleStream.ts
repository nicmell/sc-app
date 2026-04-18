import type {Channel} from '@tauri-apps/api/core';
import {IS_TAURI} from '@/lib/env';

export type SampleHandler = (samples: Float32Array) => void;

export interface SampleStream {
    open(): Promise<void>;
    close(): void;
    onSamples(cb: SampleHandler): void;
}

/**
 * Shared transport for binary float32 audio streams. Two backends:
 *
 * - **Tauri (native)**: a `Channel<number[]>` wired to a pair of Tauri
 *   commands. `start(channel)` kicks off streaming and may return an opaque
 *   handle (e.g. a subscription id); that handle is passed back to `stop()`
 *   on close.
 * - **WebSocket (serve)**: a binary WS at `ws://.../{path}`. Each frame is
 *   `[numSamples u32 LE][f32 LE × n]`. `onOpen` may send a configuration
 *   header once the socket is up.
 *
 * Consumers use `createSampleStream(spec)` with a small recipe object
 * describing the two backends; see `createBufferStream` for an example.
 */
export interface SampleStreamSpec {
    tauri: {
        start: (channel: Channel<number[]>) => Promise<unknown>;
        stop: (handle: unknown) => Promise<void>;
    };
    ws: {
        path: string;
        onOpen?: (ws: WebSocket) => void;
    };
}

class TauriSampleStream implements SampleStream {
    private cb: SampleHandler = () => {};
    private handle: unknown = null;
    private closed = false;

    constructor(private spec: SampleStreamSpec['tauri']) {}

    onSamples(cb: SampleHandler) {
        this.cb = cb;
    }

    async open() {
        const {Channel} = await import('@tauri-apps/api/core');
        const channel = new Channel<number[]>();
        channel.onmessage = (samples) => {
            if (!this.closed) this.cb(Float32Array.from(samples));
        };
        this.handle = await this.spec.start(channel);
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        const handle = this.handle;
        this.handle = null;
        if (handle !== null) void this.spec.stop(handle);
    }
}

class WebSocketSampleStream implements SampleStream {
    private cb: SampleHandler = () => {};
    private ws: WebSocket | null = null;
    private closed = false;

    constructor(private spec: SampleStreamSpec['ws']) {}

    onSamples(cb: SampleHandler) {
        this.cb = cb;
    }

    async open() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${location.host}${this.spec.path}`);
        ws.binaryType = 'arraybuffer';
        this.ws = ws;
        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => {
                try {
                    this.spec.onOpen?.(ws);
                } catch (e) {
                    reject(e instanceof Error ? e : new Error(String(e)));
                    return;
                }
                resolve();
            };
            ws.onerror = () => reject(new Error('WebSocket error'));
        });
        ws.onmessage = (ev) => {
            if (this.closed) return;
            const data = ev.data as ArrayBuffer;
            if (data.byteLength < 4) return;
            const view = new DataView(data);
            const n = view.getUint32(0, true);
            if (data.byteLength < 4 + n * 4) return;
            this.cb(new Float32Array(data, 4, n));
        };
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        this.ws?.close();
        this.ws = null;
    }
}

export function createSampleStream(spec: SampleStreamSpec): SampleStream {
    return IS_TAURI
        ? new TauriSampleStream(spec.tauri)
        : new WebSocketSampleStream(spec.ws);
}
