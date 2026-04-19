import type {Channel} from '@tauri-apps/api/core';

export type SampleHandler = (samples: Float32Array) => void;

/**
 * Transport-specific implementation that produces f32 sample batches. Adapters
 * own their lifecycle (`open` / `close`) and surface incoming samples through
 * a single `onMessages` hook, which the wrapping `SampleStream` bridges to its
 * event-emitter surface.
 */
export interface SampleStreamAdapter {
    open(): Promise<void>;
    close(): void;
    onMessages(cb: SampleHandler): void;
}

export interface TauriSampleStreamSpec {
    start: (channel: Channel<number[]>) => Promise<unknown>;
    stop: (handle: unknown) => Promise<void>;
}

export interface WebSocketSampleStreamSpec {
    path: string;
    onOpen?: (ws: WebSocket) => void;
}

/** Events emitted by `SampleStream`. */
export interface SampleStreamEventMap {
    message: [samples: Float32Array];
}

type Listener = (...args: unknown[]) => void;

/**
 * Event-emitter wrapper around a `SampleStreamAdapter`. Consumers register
 * for sample batches with `stream.on('message', cb)` and unregister with
 * `stream.off('message', cb)`; shape modelled on `TauriDatagramSocket`.
 *
 * Construct directly with an adapter:
 *   new SampleStream(new TauriSampleStreamAdapter({start, stop}))
 *   new SampleStream(new WebSocketSampleStreamAdapter({path, onOpen}))
 */
export class SampleStream {
    private listeners: Record<string, Listener[]> = {};
    private _isOpen = false;
    private _closed = false;

    constructor(private adapter: SampleStreamAdapter) {
        this.adapter.onMessages((samples) => this.emit('message', samples));
    }

    get isOpen(): boolean {
        return this._isOpen;
    }

    async open(): Promise<void> {
        await this.adapter.open();
        // Guard against a `close()` that landed while `adapter.open()` was
        // still pending — don't flip `isOpen` back to `true` in that case.
        if (!this._closed) this._isOpen = true;
    }

    close(): void {
        this._closed = true;
        this._isOpen = false;
        this.adapter.close();
    }

    on<E extends keyof SampleStreamEventMap>(
        event: E,
        callback: (...args: SampleStreamEventMap[E]) => void,
    ): void {
        (this.listeners[event] ??= []).push(callback as Listener);
    }

    off<E extends keyof SampleStreamEventMap>(
        event: E,
        callback: (...args: SampleStreamEventMap[E]) => void,
    ): void {
        const arr = this.listeners[event];
        if (!arr) return;
        const i = arr.indexOf(callback as Listener);
        if (i >= 0) arr.splice(i, 1);
    }

    private emit<E extends keyof SampleStreamEventMap>(
        event: E,
        ...args: SampleStreamEventMap[E]
    ): void {
        const cbs = this.listeners[event];
        if (!cbs) return;
        for (const cb of cbs) {
            (cb as (...a: SampleStreamEventMap[E]) => void)(...args);
        }
    }
}

export class TauriSampleStreamAdapter implements SampleStreamAdapter {
    private cb: SampleHandler = () => {};
    private handle: unknown = null;
    private closed = false;

    constructor(private spec: TauriSampleStreamSpec) {}

    onMessages(cb: SampleHandler): void {
        this.cb = cb;
    }

    async open(): Promise<void> {
        const {Channel} = await import('@tauri-apps/api/core');
        const channel = new Channel<number[]>();
        channel.onmessage = (samples) => {
            if (!this.closed) this.cb(Float32Array.from(samples));
        };
        this.handle = await this.spec.start(channel);
    }

    close(): void {
        if (this.closed) return;
        this.closed = true;
        const handle = this.handle;
        this.handle = null;
        if (handle !== null) void this.spec.stop(handle);
    }
}

export class WebSocketSampleStreamAdapter implements SampleStreamAdapter {
    private cb: SampleHandler = () => {};
    private ws: WebSocket | null = null;
    private closed = false;

    constructor(private spec: WebSocketSampleStreamSpec) {}

    onMessages(cb: SampleHandler): void {
        this.cb = cb;
    }

    async open(): Promise<void> {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${location.host}${this.spec.path}`);
        ws.binaryType = 'arraybuffer';
        this.ws = ws;
        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => {
                try {
                    this.spec.onOpen?.(ws);
                } catch (e) {
                    return reject(e instanceof Error ? e : new Error(String(e)));
                }
                resolve();
            };
            ws.onerror = () => {
                reject(new Error('WebSocket error'));
            };
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

    close(): void {
        if (this.closed) return;
        this.closed = true;
        this.ws?.close();
        this.ws = null;
    }
}
