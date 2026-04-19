import {html} from 'lit';
import type {ScBufferItem, ControlRuntime} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer, isControl, isNode, isSynth} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {bufferManager, type BufferStream} from '@/lib/buffers';
import {runtimeApi} from '@/lib/stores/api';
import {ScElement} from './internal/sc-element.ts';

interface BufferState {
    loaded: boolean;
    active: boolean;
    hasRunningWriter: boolean;
}

/**
 * Walk up the parentId chain from `nodeId`. A synth is "effectively running"
 * only if it has `run === 1` and every NodeRuntime ancestor up to the root
 * plugin also has `run === 1`. Any `run === 0` anywhere in the chain pauses
 * the subtree at scsynth, so RecordBuf wouldn't be ticking either.
 */
function isEffectivelyRunning(state: RuntimeState, nodeId: string): boolean {
    let id = nodeId;
    while (id) {
        const node = state.nodes[id];
        if (!node) return false;
        if (isNode(node) && !node.runtime.run) return false;
        id = node.runtime.parentId;
    }
    return true;
}

/**
 * True iff any synth in the runtime tree has a child `sc-control` whose
 * `bind` resolves to this buffer's id AND is effectively running. This is
 * the signal we drive `BufferRuntime.active` from.
 */
function hasRunningWriterFor(state: RuntimeState, bufferId: string): boolean {
    for (const id in state.nodes) {
        const node = state.nodes[id];
        if (!isSynth(node)) continue;
        const writes = node.children.some(child => {
            if (!isControl(child)) return false;
            const targets = (child.runtime as ControlRuntime).targets;
            return !!targets && Object.values(targets).includes(bufferId);
        });
        if (!writes) continue;
        if (isEffectivelyRunning(state, id)) return true;
    }
    return false;
}

export class ScBuffer extends ScElement<ScBufferItem, BufferState> {
    static properties = {
        name: {type: String, reflect: true},
        frames: {type: Number},
        channels: {type: Number},
    };

    declare name: string;
    declare frames: number;
    declare channels: number;

    readonly bufnum = oscService.nextBufNum();

    private _stream: BufferStream | null = null;

    constructor() {
        super();
        this.name = '';
        this.frames = 44100;
        this.channels = 1;
    }

    getState(state: RuntimeState): BufferState {
        const node = state.nodes[this.id];
        if (!node || !isBuffer(node)) {
            return {loaded: false, active: false, hasRunningWriter: false};
        }
        return {
            loaded: node.runtime.loaded,
            active: node.runtime.active,
            hasRunningWriter: hasRunningWriterFor(state, this.id),
        };
    }

    protected _onStateChange(prev: BufferState, next: BufferState): void {
        // 1. Reconcile the store's `active` with the derived "should be active"
        //    signal. The reducer is a no-op when the flag is already correct,
        //    so this doesn't loop.
        if (next.hasRunningWriter !== next.active) {
            if (next.hasRunningWriter) {
                runtimeApi.startBuffer({id: this.id});
            } else {
                runtimeApi.stopBuffer({id: this.id});
            }
        }

        // 2. React to `active` transitions to cycle the stream.
        const shouldBeOpen = next.loaded && next.active;
        const wasOpen = !!prev && prev.loaded && prev.active;
        if (shouldBeOpen && !wasOpen) {
            void this._openStream();
        } else if (!shouldBeOpen && wasOpen) {
            this._closeStream();
        }

        super._onStateChange(prev, next);
    }

    protected _sendCreate() {
        oscService.allocBuffer(this.id, this.bufnum, this.frames, this.channels);
        super._sendCreate();
    }

    protected _sendDestroy() {
        this._closeStream();
        oscService.freeBuffer(this.id, this.bufnum);
        super._sendDestroy();
    }

    private async _openStream(): Promise<void> {
        if (this._stream) return;
        const stream = bufferManager.getBuffer(this.id);
        if (!stream) return;
        this._stream = stream;
        if (!stream.isOpen) await stream.open();
    }

    private _closeStream(): void {
        if (this._stream) {
            this._stream.close();
            this._stream = null;
        }
    }

    render() {
        return html``;
    }
}
