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
    private _gen = 0;

    constructor(private adapter: SampleStreamAdapter) {
        this.adapter.onMessages((samples) => this.emit('message', samples));
    }

    get isOpen(): boolean {
        return this._isOpen;
    }

    async open(): Promise<void> {
        const gen = ++this._gen;
        await this.adapter.open();
        // Skip the flip if a `close()` (or another `open()`) landed while the
        // adapter was still starting — our open is superseded.
        if (gen === this._gen) this._isOpen = true;
    }

    close(): void {
        this._gen++;
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
    private _gen = 0;

    constructor(private spec: TauriSampleStreamSpec) {}

    onMessages(cb: SampleHandler): void {
        this.cb = cb;
    }

    async open(): Promise<void> {
        const gen = ++this._gen;
        const {Channel} = await import('@tauri-apps/api/core');
        const channel = new Channel<number[]>();
        channel.onmessage = (samples) => this.cb(Float32Array.from(samples));
        const handle = await this.spec.start(channel);
        if (gen !== this._gen) {
            // close() landed during the await — free the subscription we
            // just acquired so scsynth doesn't keep sending to an orphan.
            void this.spec.stop(handle);
            return;
        }
        this.handle = handle;
    }

    close(): void {
        this._gen++;
        const handle = this.handle;
        this.handle = null;
        if (handle !== null) void this.spec.stop(handle);
    }
}

export class WebSocketSampleStreamAdapter implements SampleStreamAdapter {
    private cb: SampleHandler = () => {};
    private ws: WebSocket | null = null;
    private _gen = 0;

    constructor(private spec: WebSocketSampleStreamSpec) {}

    onMessages(cb: SampleHandler): void {
        this.cb = cb;
    }

    async open(): Promise<void> {
        const gen = ++this._gen;
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${location.host}${this.spec.path}`);
        ws.binaryType = 'arraybuffer';
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
        if (gen !== this._gen) {
            // close() landed during the handshake — drop the socket we just
            // opened before wiring its onmessage handler.
            ws.close();
            return;
        }
        this.ws = ws;
        ws.onmessage = (ev) => {
            const data = ev.data as ArrayBuffer;
            if (data.byteLength < 4) return;
            const view = new DataView(data);
            const n = view.getUint32(0, true);
            if (data.byteLength < 4 + n * 4) return;
            this.cb(new Float32Array(data, 4, n));
        };
    }

    close(): void {
        this._gen++;
        this.ws?.close();
        this.ws = null;
    }
}
