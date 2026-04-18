import {IS_TAURI} from '@/lib/env';
import {createSampleStream, type SampleStream} from '@/lib/sampleStream/SampleStream';

export type RecordingStream = SampleStream;

/** HTTP root for recording CRUD, matching the plugins pattern. */
export const RECORDINGS_URL = IS_TAURI ? 'app://recordings' : '/recordings';

export interface RecordingHandle {
    id: string;
    path: string;
}

export interface RecordingInfo {
    id: string;
    path: string;
    size_bytes: number;
}

export interface RecordingStreamConfig {
    id: string;
    bufnum: number;
    frames: number;
    chunk: number;
    sampleRate: number;
    channels: number;
    scsynthAddr: string;
}

// ── CRUD (via the `app://recordings/…` URI scheme / `/recordings/…` HTTP) ──

export async function openRecording(): Promise<RecordingHandle> {
    const resp = await fetch(RECORDINGS_URL, {method: 'POST'});
    if (!resp.ok) throw new Error(`record open failed: ${resp.status}`);
    return resp.json();
}

export async function readRecording(id: string): Promise<Blob> {
    const resp = await fetch(`${RECORDINGS_URL}/${encodeURIComponent(id)}.wav`);
    if (!resp.ok) throw new Error(`record read failed: ${resp.status}`);
    return resp.blob();
}

export async function listRecordings(): Promise<RecordingInfo[]> {
    const resp = await fetch(RECORDINGS_URL);
    if (!resp.ok) throw new Error(`record list failed: ${resp.status}`);
    return resp.json();
}

export async function deleteRecording(id: string): Promise<void> {
    const resp = await fetch(`${RECORDINGS_URL}/${encodeURIComponent(id)}`, {method: 'DELETE'});
    if (!resp.ok && resp.status !== 404) {
        throw new Error(`record delete failed: ${resp.status}`);
    }
}

// ── Live streaming from the recording's source buffer ──────────────────────
//
// The stream polls scsynth for samples on `bufnum` (via `/b_getn`), forwards
// them to the frontend for the live waveform, and writes the same samples
// into the `{id}.wav` file on disk as a side effect. Closing the stream
// unsubscribes on the Rust side, which drops the recording sink and finalises
// the WAV header.

export function createRecordingStream(cfg: RecordingStreamConfig): RecordingStream {
    return createSampleStream({
        tauri: {
            start: async (channel) => {
                const {invoke} = await import('@tauri-apps/api/core');
                return invoke<number>('record_stream_start', {
                    id: cfg.id,
                    bufnum: cfg.bufnum,
                    frames: cfg.frames,
                    chunk: cfg.chunk,
                    sampleRate: cfg.sampleRate,
                    channels: cfg.channels,
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
            path: `/recordings/${encodeURIComponent(cfg.id)}/stream`,
            onOpen: (ws) => {
                const header = new ArrayBuffer(20);
                const view = new DataView(header);
                view.setInt32(0, cfg.bufnum, true);
                view.setInt32(4, cfg.chunk, true);
                view.setInt32(8, cfg.frames, true);
                view.setInt32(12, cfg.sampleRate, true);
                view.setInt32(16, cfg.channels, true);
                ws.send(header);
            },
        },
    });
}
