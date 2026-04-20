import {oscService} from '@/lib/osc';
import {runtimeApi} from '@/lib/stores/api';
import type {ControlRuntime, ScSynthItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isBuffer, isControl, isNode, isSynth, isSynthDef} from '@/lib/utils/guards';
import type {NodeContext} from './context.ts';
import {ScNode} from './internal/sc-node.ts';

interface SynthState {
    item: ScSynthItem | undefined;
    depsReady: boolean;
    loaded: boolean;
}

/**
 * `/s_new` references a synthdef by name and may carry control values that
 * resolve to buffer numbers (via `sc-control bind="bufferName"`). If we fire
 * `/s_new` before the synthdef has been `/d_recv`-ed or before its bound
 * buffers have been `/b_alloc`-ed, scsynth rejects the message ("SynthDef
 * not found" / "Buffer not allocated"). This helper walks the store to
 * decide whether all of those dependencies are satisfied right now.
 */
function computeDepsReady(state: RuntimeState, self: ScSynthItem, bind: string): boolean {
    const parent = state.nodes[self.runtime.parentId];
    if (!parent || !isNode(parent) || !parent.runtime.loaded) return false;

    let synthdefLoaded = false;
    for (const id in state.nodes) {
        const n = state.nodes[id];
        if (!isSynthDef(n)) continue;
        if (n.name !== bind) continue;
        if (n.runtime.rootId !== self.runtime.rootId) continue;
        if (!n.runtime.loaded) return false;
        synthdefLoaded = true;
        break;
    }
    if (!synthdefLoaded) return false;

    for (const child of self.children) {
        if (!isControl(child)) continue;
        const targets = (child.runtime as ControlRuntime).targets;
        if (!targets) continue;
        for (const targetId of Object.values(targets)) {
            const target = state.nodes[targetId];
            if (target && isBuffer(target) && !target.runtime.loaded) return false;
        }
    }
    return true;
}

export class ScSynth extends ScNode<ScSynthItem, SynthState> {
    static properties = {
        ...ScNode.properties,
        bind: {type: String},
    };

    declare bind: string;

    private _creating: Promise<void> | null = null;

    constructor() {
        super();
        this.bind = 'default';
    }

    getState(state: RuntimeState): SynthState {
        const item = state.nodes[this.id];
        if (!item || !isSynth(item)) return {item: undefined, depsReady: false, loaded: false};
        return {
            item,
            depsReady: computeDepsReady(state, item, this.bind),
            loaded: item.runtime.loaded,
        };
    }

    protected _contextValue(): NodeContext {
        return this._state.item;
    }

    protected _nodeItem(): ScSynthItem | undefined {
        return this._state.item;
    }

    protected _onStateChange(prev: SynthState, next: SynthState): void {
        if (this._loaded && next.depsReady && !next.loaded && !this._creating) {
            this._creating = this._fireCreate();
        }
        super._onStateChange(prev, next);
    }

    protected _sendCreate() {
        super._sendCreate();
        const state = this._state;
        if (state.depsReady && !state.loaded && !this._creating) {
            this._creating = this._fireCreate();
        }
    }

    protected async _sendDestroy() {
        super._sendDestroy();
        if (this._creating) {
            try { await this._creating; } catch { /* swallow */ }
        }
        if (this._state.loaded) {
            await oscService.freeSynth(this.nodeId);
            runtimeApi.freeSynth({id: this.id});
        }
    }

    private async _fireCreate(): Promise<void> {
        try {
            await oscService.createSynth(this.bind, this.nodeId, this.groupId, this.getControls(), this.run);
            runtimeApi.newSynth({id: this.id, nodeId: this.nodeId});
        } finally {
            this._creating = null;
        }
    }
}
