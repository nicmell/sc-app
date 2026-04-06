import {html} from 'lit';
import type {ScElementItem, ScElementItemBase} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {ScElement} from './sc-element.ts';

/**
 * Base class for declarative state elements (sc-control, sc-var).
 * Both hold a named numeric value in their runtime.
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
        return node && this._match(node) ? (node.runtime as { value: number }).value : 0;
    }

    render() {
        return html``;
    }
}
