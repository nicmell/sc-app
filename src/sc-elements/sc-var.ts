import type {ScVarItem, ScElementItemBase} from '@/types/parsers';
import {isVar} from '@/lib/utils/guards';
import {ScState} from './internal/sc-state.ts';

export class ScVar extends ScState<ScVarItem> {
    protected _match(node: ScElementItemBase): node is ScVarItem {
        return isVar(node);
    }
}
