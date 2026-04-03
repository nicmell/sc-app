import {LitElement} from 'lit';
import type {ScElementNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {store} from '@/lib/stores/store';

export abstract class ScElement<T extends ScElementNode> extends LitElement {
    private _unsubscribe?: () => void;

    protected abstract getState(state: RuntimeState): unknown;

    get _runtime(): T["runtime"] {
        const el = runtimeApi.getById(this.id);
        if (!el) {
            throw new Error(`<${this.tagName.toLowerCase()} id="${this.id}"> not found in store`);
        }
        return el.runtime as T["runtime"];
    }

    get _state() {
        const {runtime} = store.getState();
        return this.getState(runtime);
    }

    protected _subscribe(): () => void {
        let prev = this._state;
        return store.subscribe(() => {
            const {runtime} = store.getState();
            const next = this.getState(runtime);
            if (next !== prev) {
                prev = next;
                this.requestUpdate();
            }
        });
    }

    connectedCallback() {
        super.connectedCallback();
        this._unsubscribe = this._subscribe();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribe?.();
    }
}
