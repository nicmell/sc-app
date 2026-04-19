import {IS_TAURI} from '@/lib/env';
import {
    SampleStream,
    TauriSampleStreamAdapter,
    WebSocketSampleStreamAdapter,
    type SampleStreamAdapter,
} from '@/lib/buffers/SampleStream';
import {optionsApi, rootApi, runtimeApi} from '@/lib/stores/api';
import {isBuffer} from '@/lib/utils/guards';

export type BufferStream = SampleStream;

/**
 * Cap on samples per `/b_getn` request. The Rust reader runs a wall-clock
 * catch-up loop keyed to the buffer's sample rate and issues as many requests
 * as needed each tick; this just bounds UDP payload size.
 */
const STREAM_CHUNK = 1024;

interface BufferStreamConfig {
    bufnum: number;
    frames: number;
    chunk: number;
    sampleRate: number;
    scsynthAddr: string;
}

function createStream(cfg: BufferStreamConfig): SampleStream {
    const adapter: SampleStreamAdapter = IS_TAURI
        ? new TauriSampleStreamAdapter({
            start: async (channel) => {
                const {invoke} = await import('@tauri-apps/api/core');
                return invoke<number>('buffer_subscribe', {
                    bufnum: cfg.bufnum,
                    frames: cfg.frames,
                    chunk: cfg.chunk,
                    sampleRate: cfg.sampleRate,
                    scsynthAddr: cfg.scsynthAddr,
                    channel,
                });
            },
            stop: async (handle) => {
                const {invoke} = await import('@tauri-apps/api/core');
                await invoke('buffer_unsubscribe', {subId: handle});
            },
        })
        : new WebSocketSampleStreamAdapter({
            path: `/buffer/${cfg.bufnum}`,
            onOpen: (ws) => {
                const header = new ArrayBuffer(16);
                const view = new DataView(header);
                view.setInt32(0, cfg.bufnum, true);
                view.setInt32(4, cfg.chunk, true);
                view.setInt32(8, cfg.frames, true);
                view.setInt32(12, cfg.sampleRate, true);
                ws.send(header);
            },
        });
    return new SampleStream(adapter);
}

/**
 * Lazily-populated cache of per-buffer `SampleStream` instances, keyed by the
 * `sc-buffer` node's runtime id. The first `getBuffer(id)` call reads the
 * buffer's current `bufnum` / `frames` from the runtime store, together with
 * the current sample rate and scsynth address, and builds the transport-
 * appropriate stream; subsequent calls return the cached instance.
 *
 * Streams cached here are not closed automatically — they are shared across
 * any component bound to the same buffer and live for the lifetime of the
 * manager. Consumers subscribe/unsubscribe via `stream.on('message', …)` /
 * `stream.off('message', …)` rather than opening or closing themselves.
 */
export class BufferManager {
    private streams = new Map<string, SampleStream>();

    getBuffer(id: string): SampleStream | null {
        const cached = this.streams.get(id);
        if (cached) return cached;

        const node = runtimeApi.nodes[id];
        if (!node || !isBuffer(node)) return null;
        const buf = node.runtime;
        if (!buf.loaded || buf.bufnum <= 0) return null;

        const sampleRate = rootApi.serverStatus.sampleRate;
        if (sampleRate <= 0) return null;

        const {host, port} = optionsApi.scsynth;
        const stream = createStream({
            bufnum: buf.bufnum,
            frames: buf.frames,
            chunk: STREAM_CHUNK,
            sampleRate: Math.round(sampleRate),
            scsynthAddr: `${host}:${port}`,
        });
        this.streams.set(id, stream);
        return stream;
    }
}
