import {runtimeApi} from '@/lib/stores/api';
import type {ContextConsumer} from '@lit/context';
import type {NodeContext} from './context.ts';

export function resolveEntryId(
    nodeCtx: ContextConsumer<{__context__: NodeContext}, any>,
    elementId: string,
    type: string,
): string | undefined {
    const boxId = nodeCtx.value?.boxId();
    if (!boxId) return undefined;
    const el = runtimeApi.getById(elementId);
    if (!el || el.type !== type) return undefined;
    return 'value' in el.runtime ? el.runtime.value : undefined;
}
