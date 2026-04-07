import type {ScElementItem, InputRuntime} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isInput, isVisual, isState, isVar} from '@/lib/utils/guards';
import {ScElement} from './sc-element.ts';

export function resolveStateValue(state: RuntimeState, targetId: string): number {
    let id = targetId;
    while (id) {
        const node = state.nodes[id];
        if (!node || !isState(node)) return 0;
        if (node.runtime.targetId) {
            id = node.runtime.targetId;
        } else {
            return node.runtime.value;
        }
    }
    return 0;
}

/**
 * Base class for elements that read a value from a targeted control or var.
 * Shared by sc-range, sc-checkbox, sc-select, sc-radio-group, sc-display, sc-if.
 */
export abstract class ScInput<T extends ScElementItem & { runtime: InputRuntime }> extends ScElement<T, number> {

    getState(state: RuntimeState): number {
        const self = state.nodes[this.id];
        if (!self || !(isInput(self) || isVisual(self))) return 0;
        return resolveStateValue(state, self.runtime.targetId);
    }

    protected _dispatchChange(value: number): void {
        const targetId = (this._runtime as InputRuntime)?.targetId;
        if (!targetId) return;
        const target = runtimeApi.getById(targetId);
        if (target && isVar(target)) {
            runtimeApi.setVar({id: targetId, value});
        } else {
            runtimeApi.setControl({id: targetId, value});
        }
    }
}
