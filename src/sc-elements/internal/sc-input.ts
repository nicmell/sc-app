import type {ScElementItem, InputRuntime} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {isInput, isVisual, isState, isVar} from '@/lib/utils/guards';
import {evalExpr, type Expr} from '@/lib/utils/expression';
import {ScElement} from './sc-element.ts';

export function resolveStateValue(state: RuntimeState, targetId: string): number {
    let id = targetId;
    let pendingExpressions: Expr[] = [];
    while (id) {
        const node = state.nodes[id];
        if (!node || !isState(node)) return 0;
        if (node.runtime.expression) pendingExpressions.push(node.runtime.expression);
        if (node.runtime.targetId) {
            id = node.runtime.targetId;
        } else {
            let value = node.runtime.value;
            for (let i = pendingExpressions.length - 1; i >= 0; i--) {
                value = evalExpr(pendingExpressions[i], value);
            }
            return value;
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
