import {IS_TAURI} from '@/lib/env';

export type TickHandler = (samples: Float32Array) => void;

export interface BufferStream {
    open(): Promise<void>;
    close(): void;
    onTick(cb: TickHandler): void;
}

export interface BufferStreamConfig {
    bufnum: number;
    frames: number;
    chunk: number;
    scsynthAddr: string;
}

class TauriChannelStream implements BufferStream {
    private tick: TickHandler = () => {};
    private subId: number | null = null;
    private closed = false;

    constructor(private cfg: BufferStreamConfig) {}

    onTick(cb: TickHandler) {
        this.tick = cb;
    }

    async open() {
        const {invoke, Channel} = await import('@tauri-apps/api/core');
        const channel = new Channel<number[]>();
        channel.onmessage = (samples) => {
            if (!this.closed) this.tick(Float32Array.from(samples));
        };
        this.subId = await invoke<number>('buffer_subscribe', {
            bufnum: this.cfg.bufnum,
            frames: this.cfg.frames,
            chunk: this.cfg.chunk,
            scsynthAddr: this.cfg.scsynthAddr,
            channel,
        });
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        const id = this.subId;
        this.subId = null;
        if (id != null) {
            void import('@tauri-apps/api/core').then(({invoke}) =>
                invoke('buffer_unsubscribe', {subId: id}),
            );
        }
    }
}

class WebSocketStream implements BufferStream {
    private tick: TickHandler = () => {};
    private ws: WebSocket | null = null;
    private closed = false;

    constructor(private cfg: BufferStreamConfig) {}

    onTick(cb: TickHandler) {
        this.tick = cb;
    }

    async open() {
        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${location.host}/buffer/${this.cfg.bufnum}`);
        ws.binaryType = 'arraybuffer';
        this.ws = ws;

        await new Promise<void>((resolve, reject) => {
            ws.onopen = () => {
                const header = new ArrayBuffer(12);
                const view = new DataView(header);
                view.setInt32(0, this.cfg.bufnum, true);
                view.setInt32(4, this.cfg.chunk, true);
                view.setInt32(8, this.cfg.frames, true);
                ws.send(header);
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
            const samples = new Float32Array(data, 4, n);
            this.tick(samples);
        };
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

export function createBufferStream(cfg: BufferStreamConfig): BufferStream {
    return IS_TAURI ? new TauriChannelStream(cfg) : new WebSocketStream(cfg);
}
