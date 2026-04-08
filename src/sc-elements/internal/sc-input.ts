import type {ScElementItem, InputRuntime} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isInput, isVisual, isState, isVar, isBuffer} from '@/lib/utils/guards';
import {evalExpr} from '@/lib/utils/expression';
import {ScElement} from './sc-element.ts';

function readStateValue(state: RuntimeState, id: string): number {
    const node = state.nodes[id];
    if (node && isBuffer(node)) return node.runtime.bufnum;
    if (!node || !isState(node)) return 0;
    const rt = node.runtime;
    if (rt.targets) {
        const values: Record<string, number> = {};
        for (const [path, targetId] of Object.entries(rt.targets)) {
            values[path] = readStateValue(state, targetId);
        }
        return rt.expression ? evalExpr(rt.expression, values) : values[Object.keys(values)[0]] ?? 0;
    }
    return rt.value;
}

export function resolveStateValue(state: RuntimeState, targetId: string): number {
    return readStateValue(state, targetId);
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
