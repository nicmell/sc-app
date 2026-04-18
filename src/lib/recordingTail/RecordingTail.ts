import {IS_TAURI} from '@/lib/env';
import {createSampleStream, type SampleStream} from '@/lib/sampleStream/SampleStream';

export type RecordingTail = SampleStream;

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

// ── Streaming tail on a recording id ───────────────────────────────────────

export function createRecordingTail(id: string): RecordingTail {
    return createSampleStream({
        tauri: {
            start: async (channel) => {
                const {invoke} = await import('@tauri-apps/api/core');
                await invoke('record_tail_start', {id, channel});
                return id;
            },
            stop: async () => {
                const {invoke} = await import('@tauri-apps/api/core');
                await invoke('record_tail_stop', {id});
            },
        },
        ws: {
            path: `/recordings/${encodeURIComponent(id)}/tail`,
        },
    });
}
