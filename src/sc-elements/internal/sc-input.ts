import type {ScElementItem, InputRuntime} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isState, isVar} from '@/lib/utils/guards';
import {ScElement} from './sc-element.ts';

/**
 * Base class for elements that read a value from a targeted control or var.
 * Shared by sc-range, sc-checkbox, sc-select, sc-radio-group, sc-display, sc-if.
 */
export abstract class ScInput<T extends ScElementItem & { runtime: InputRuntime }> extends ScElement<T, number> {

    getState(state: RuntimeState): number {
        const self = state.nodes[this.id];
        if (!self || !('targetId' in self.runtime)) return 0;
        const target = state.nodes[(self.runtime as InputRuntime).targetId];
        return target && isState(target) ? target.runtime.value : 0;
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
