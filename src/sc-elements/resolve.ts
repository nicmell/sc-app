import type {InputRuntime} from '@/types/parsers';
import {runtimeApi} from '@/lib/stores/api';
import {isNode, isControl} from '@/lib/utils/guards';

export function resolveInputRuntime(
    elementId: string,
    type: string,
): InputRuntime | undefined {
    const el = runtimeApi.getById(elementId);
    if (!el || el.type !== type) return undefined;
    return el.runtime as InputRuntime;
}

export function resolveControlNodeId(controlId: string): number {
    const control = runtimeApi.getById(controlId);
    if (!control || !isControl(control)) return 0;
    const parent = runtimeApi.getById(control.runtime.parentId);
    return parent && isNode(parent) ? parent.runtime.nodeId : 0;
}
