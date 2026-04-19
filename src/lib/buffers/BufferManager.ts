import {IS_TAURI} from '@/lib/env';
import {
    SampleStream,
    TauriSampleStreamAdapter,
    WebSocketSampleStreamAdapter,
    type SampleHandler,
    type SampleStreamAdapter,
} from '@/lib/buffers/SampleStream';
import {optionsApi, rootApi, runtimeApi} from '@/lib/stores/api';
import {store} from '@/lib/stores/store';
import {isBuffer, isControl, isNode, isSynth} from '@/lib/utils/guards';
import type {ScElementItem} from '@/types/parsers';

export type BufferStream = SampleStream;

/** Events emitted by a `BufferSubscription`. */
export interface BufferSubscriptionEventMap {
    /** Fires when the shared stream for this buffer is deactivated because
     *  no running synth on the server writes to it any more. Subscribers
     *  typically use this to clear their UI / reset "has signal" flags. */
    idle: [];
    /** Fires when the stream is (re)activated after being idle. Not fired
     *  for the initial activation that might precede any listener registration. */
    active: [];
}

type SubListener = (...args: unknown[]) => void;

/**
 * Handle returned by `BufferManager.subscribe`. Primary channel is the sample
 * handler passed at subscribe time; additional lifecycle signals are exposed
 * as events (`idle` / `active`).
 */
export interface BufferSubscription {
    close(): void;
    on<E extends keyof BufferSubscriptionEventMap>(
        event: E,
        cb: (...args: BufferSubscriptionEventMap[E]) => void,
    ): void;
    off<E extends keyof BufferSubscriptionEventMap>(
        event: E,
        cb: (...args: BufferSubscriptionEventMap[E]) => void,
    ): void;
}

class SubscriptionImpl implements BufferSubscription {
    private listeners: Record<string, SubListener[]> = {};
    private _closed = false;

    constructor(
        public readonly handler: SampleHandler,
        private readonly _closeImpl: () => void,
    ) {}

    close(): void {
        if (this._closed) return;
        this._closed = true;
        this._closeImpl();
    }

    on<E extends keyof BufferSubscriptionEventMap>(
        event: E,
        cb: (...args: BufferSubscriptionEventMap[E]) => void,
    ): void {
        (this.listeners[event] ??= []).push(cb as SubListener);
    }

    off<E extends keyof BufferSubscriptionEventMap>(
        event: E,
        cb: (...args: BufferSubscriptionEventMap[E]) => void,
    ): void {
        const arr = this.listeners[event];
        if (!arr) return;
        const i = arr.indexOf(cb as SubListener);
        if (i >= 0) arr.splice(i, 1);
    }

    emit<E extends keyof BufferSubscriptionEventMap>(
        event: E,
        ...args: BufferSubscriptionEventMap[E]
    ): void {
        const arr = this.listeners[event];
        if (!arr) return;
        for (const cb of arr) {
            (cb as (...a: BufferSubscriptionEventMap[E]) => void)(...args);
        }
    }
}

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

interface BufferEntry {
    bufferId: string;
    bufnum: number;
    subscriptions: Set<SubscriptionImpl>;
    /** `null` when no running synth is currently writing to this buffer. */
    stream: SampleStream | null;
}

/**
 * Broker between frontend sample consumers and the per-buffer Rust streaming
 * task. Polling on the backend is gated on **two** independent conditions:
 *
 *  1. At least one subscriber here wants samples.
 *  2. At least one effectively-running synth on the server writes into this
 *     buffer (i.e. has an `sc-control` whose `bind` resolves to the buffer,
 *     and whose ancestor chain up to the plugin root is all running).
 *
 * The manager subscribes to the runtime store and re-evaluates condition (2)
 * on every state change. When (2) flips true → creates a stream and opens
 * it (the Rust reader zeroes the buffer and starts polling `/b_getn`). When
 * (2) flips false → closes the stream (backend tears its task down) and
 * fires `idle` on every live subscription. If the synth resumes, a fresh
 * stream replaces it and `active` fires.
 *
 * Subscribers just register a handler and get samples whenever they flow.
 * Silence when nothing writes is expected; the `idle` event lets components
 * clean up their UI state without polling for absence.
 */
export class BufferManager {
    private entries = new Map<string, BufferEntry>();

    constructor() {
        // Re-evaluate every buffer's polling state whenever the runtime
        // changes — synth run/free, buffer alloc/free, bind edits, etc.
        store.subscribe(() => this._syncAll());
    }

    subscribe(id: string, handler: SampleHandler): BufferSubscription | null {
        const entry = this._ensureEntry(id);
        if (!entry) return null;

        const sub = new SubscriptionImpl(handler, () => this._release(id, sub));
        entry.subscriptions.add(sub);
        entry.stream?.on('message', handler);
        // A fresh subscribe might be the last thing needed for activation if
        // the usage predicate was already true — re-check now.
        this._syncEntry(entry);
        return sub;
    }

    private _ensureEntry(id: string): BufferEntry | null {
        const existing = this.entries.get(id);
        if (existing) return existing;

        const node = runtimeApi.nodes[id];
        if (!node || !isBuffer(node)) return null;
        const buf = node.runtime;
        if (!buf.loaded || buf.bufnum <= 0) return null;

        const entry: BufferEntry = {
            bufferId: id,
            bufnum: buf.bufnum,
            subscriptions: new Set(),
            stream: null,
        };
        this.entries.set(id, entry);
        return entry;
    }

    private _release(id: string, sub: SubscriptionImpl) {
        const entry = this.entries.get(id);
        if (!entry) return;
        if (!entry.subscriptions.delete(sub)) return;
        entry.stream?.off('message', sub.handler);
        if (entry.subscriptions.size === 0) {
            this._deactivate(entry);
            this.entries.delete(id);
        }
    }

    // ── Activation / deactivation driven by server-side usage ─────────────

    private _syncAll() {
        for (const entry of this.entries.values()) {
            this._syncEntry(entry);
        }
    }

    private _syncEntry(entry: BufferEntry) {
        if (entry.subscriptions.size === 0) return;
        const inUse = this._isBufferInUse(entry.bufferId);
        if (inUse && !entry.stream) {
            this._activate(entry);
        } else if (!inUse && entry.stream) {
            this._deactivate(entry);
        }
    }

    private _activate(entry: BufferEntry) {
        const buf = runtimeApi.nodes[entry.bufferId];
        if (!buf || !isBuffer(buf)) return;
        const runtime = buf.runtime;
        if (!runtime.loaded || runtime.bufnum <= 0) return;

        const sampleRate = rootApi.serverStatus.sampleRate;
        if (sampleRate <= 0) return;

        const {host, port} = optionsApi.scsynth;
        entry.stream = createStream({
            bufnum: runtime.bufnum,
            frames: runtime.frames,
            chunk: STREAM_CHUNK,
            sampleRate: Math.round(sampleRate),
            scsynthAddr: `${host}:${port}`,
        });
        entry.bufnum = runtime.bufnum;
        for (const sub of entry.subscriptions) {
            entry.stream.on('message', sub.handler);
            sub.emit('active');
        }
        void entry.stream.open();
    }

    private _deactivate(entry: BufferEntry) {
        if (!entry.stream) return;
        entry.stream.close();
        entry.stream = null;
        // The Rust reader zeroes the server buffer at the start of each
        // session, so we don't need to clean up here — next activation
        // begins on a wiped buffer.
        for (const sub of entry.subscriptions) {
            sub.emit('idle');
        }
    }

    // ── Usage predicate ───────────────────────────────────────────────────

    private _isBufferInUse(bufferId: string): boolean {
        const nodes = runtimeApi.nodes;
        const buf = nodes[bufferId];
        if (!buf) return false;
        const rootId = buf.runtime.rootId;

        for (const node of Object.values(nodes)) {
            if (!isSynth(node)) continue;
            if (node.runtime.rootId !== rootId) continue;
            if (!this._isEffectivelyRunning(node, nodes)) continue;
            if (this._synthBindsBuffer(node, bufferId)) return true;
        }
        return false;
    }

    private _synthBindsBuffer(synth: ScElementItem, bufferId: string): boolean {
        if (!isSynth(synth)) return false;
        for (const child of synth.children) {
            if (!isControl(child)) continue;
            const targets = child.runtime.targets;
            if (!targets) continue;
            for (const targetId of Object.values(targets)) {
                if (targetId === bufferId) return true;
            }
        }
        return false;
    }

    private _isEffectivelyRunning(node: ScElementItem, nodes: Record<string, ScElementItem>): boolean {
        let current: ScElementItem | undefined = node;
        while (current) {
            if (!isNode(current) || !current.runtime.run) return false;
            if (!current.runtime.parentId) return true;
            current = nodes[current.runtime.parentId];
        }
        return false;
    }
}
