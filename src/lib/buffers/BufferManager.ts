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

export interface BufferStreamConfig {
    bufnum: number;
    frames: number;
    chunk: number;
    sampleRate: number;
    scsynthAddr: string;
    /** `true` if the buffer's writer synth reads `PHASE_BUS` (sc-test's
     *  shared-clock recorder). The Rust reader then anchors its `/b_getn`
     *  target to `ClockService.samples_now()` instead of wall-clock.
     *  Plain `sc-buffer + RecordBuf` writers (sc-scope, sc-waveform) leave
     *  this `false`/omitted. */
    phaseTracked?: boolean;
}

/**
 * Build a `SampleStream` for a specific buffer. Exported for consumers that
 * manage their own bufnums outside the runtime store (e.g. `sc-test`, which
 * creates a private recorder synth + buffer pair).
 */
export function createBufferStream(cfg: BufferStreamConfig): SampleStream {
    const phaseTracked = cfg.phaseTracked ?? false;
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
                    phaseTracked,
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
                // Header layout matches server/buffer_ws.rs: 20 bytes, all i32
                // LE — bufnum, chunk, frames, sampleRate, phaseTracked (0/1).
                const header = new ArrayBuffer(20);
                const view = new DataView(header);
                view.setInt32(0, cfg.bufnum, true);
                view.setInt32(4, cfg.chunk, true);
                view.setInt32(8, cfg.frames, true);
                view.setInt32(12, cfg.sampleRate, true);
                view.setInt32(16, phaseTracked ? 1 : 0, true);
                ws.send(header);
            },
        });
    return new SampleStream(adapter);
}

/**
 * Lazily-populated cache of per-buffer `SampleStream` instances, keyed by the
 * `sc-buffer` node's runtime id. The first `getBuffer(id)` call reads the
 * buffer's current `bufnum` / `frames` / `chunks` from the runtime store,
 * together with the current sample rate and scsynth address, and builds the
 * transport-appropriate stream; subsequent calls return the cached instance.
 *
 * The chunk size for `/b_getn` requests is derived per-buffer as
 * `frames / chunks` — `chunks` is how many equal-sized reads cover one buffer
 * cycle. A ratio of 4 gives a 50% "safe zone" between reader and writer heads
 * (no within-read wrap of the cyclic buffer's write cursor); larger ratios
 * trade safe-zone width for more frequent reads.
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

        const chunks = Math.max(1, buf.chunks);
        const chunk = Math.max(1, Math.floor(buf.frames / chunks));

        const {host, port} = optionsApi.scsynth;
        const stream = createBufferStream({
            bufnum: buf.bufnum,
            frames: buf.frames,
            chunk,
            sampleRate: Math.round(sampleRate),
            scsynthAddr: `${host}:${port}`,
        });
        this.streams.set(id, stream);
        return stream;
    }
}
