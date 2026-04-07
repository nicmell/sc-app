import {html} from 'lit';
import type {ScElementItem, ScElementItemBase} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {ScElement} from './sc-element.ts';
import {resolveStateValue} from './sc-input.ts';

/**
 * Base class for declarative state elements (sc-control, sc-var).
 * Both hold a named numeric value in their runtime.
 * When bound to another state element (via targetId), reads value from the target.
 * Subclasses provide a type guard to identify their node type in the store.
 */
export abstract class ScState<T extends ScElementItem> extends ScElement<T, number> {
    static properties = {
        name: {type: String, reflect: true},
        value: {type: Number},
    };

    declare name: string;
    declare value: number | undefined;

    protected abstract _match(node: ScElementItemBase): node is T;

    getState(state: RuntimeState): number {
        const node = state.nodes[this.id];
        if (!node || !this._match(node)) return 0;
        return resolveStateValue(state, this.id);
    }

    render() {
        return html``;
    }
}
