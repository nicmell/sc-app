import {createSampleStream, type SampleStream} from '@/lib/sampleStream/SampleStream';

export type BufferStream = SampleStream;

export interface BufferStreamConfig {
    bufnum: number;
    frames: number;
    chunk: number;
    sampleRate: number;
    scsynthAddr: string;
}

export function createBufferStream(cfg: BufferStreamConfig): BufferStream {
    return createSampleStream({
        tauri: {
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
        },
        ws: {
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
        },
    });
}
