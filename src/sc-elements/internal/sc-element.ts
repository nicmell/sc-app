import {LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import type {ScElementItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {runtimeApi} from '@/lib/stores/api';
import {store} from '@/lib/stores/store';
import {nodeContext, type NodeContext} from '../context.ts';

export abstract class ScElement<T extends ScElementItem, S = unknown> extends LitElement {
    private _unsubscribe?: () => void;
    protected _loaded = false;
    private _parentCtx: ContextConsumer<{ __context__: NodeContext }, this>;

    protected abstract getState(state: RuntimeState): S;

    get _parent(): NodeContext {
        return this._parentCtx.value;
    }

    get _runtime(): T["runtime"] {
        const el = runtimeApi.getById(this.id);
        if (!el) {
            throw new Error(`<${this.tagName.toLowerCase()} id="${this.id}"> not found in store`);
        }
        return el.runtime as T["runtime"];
    }

    get _state(): S {
        const {runtime} = store.getState();
        return this.getState(runtime);
    }

    protected _onStateChange(_prev: S, _next: S): void {
        this.requestUpdate();
    }

    protected _subscribe(): () => void {
        let prev = this._state;
        return store.subscribe(() => {
            const {runtime} = store.getState();
            const next = this.getState(runtime);
            if (next !== prev) {
                const p = prev;
                prev = next;
                this._onStateChange(p, next);
            }
        });
    }

    protected _sendCreate(): void {
        this._loaded = true;
    }

    protected _sendDestroy(): void {
        this._loaded = false;
    }

    constructor() {
        super();
        this._parentCtx = new ContextConsumer(this, {
            context: nodeContext,
            subscribe: true,
            callback: (ctx) => {
                const enabled = ctx?.runtime.loaded ?? false;
                if (enabled && !this._loaded) {
                    this._sendCreate();
                } else if (!enabled && this._loaded) {
                    this._sendDestroy();
                }
            },
        });
    }

    connectedCallback() {
        super.connectedCallback();
        this._unsubscribe = this._subscribe();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribe?.();
        if (this._loaded) {
            this._sendDestroy();
        }
    }
}
