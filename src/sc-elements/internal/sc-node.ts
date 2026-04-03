import {html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {isNode, isParent, isControl} from '@/lib/utils/guards';
import {store} from '@/lib/stores/store';
import type {ScGroupNode, ScSynthNode, ScPluginNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {nodeContext, type NodeContext, type NodeState, type ScNode as IScNode} from '../context.ts';
import {ScElement} from './sc-element.ts';

export type {NodeState};

const EMPTY_STATE: NodeState = {nodeId: 0, loaded: false, run: 0, controls: {}};

export abstract class ScNode extends ScElement<ScGroupNode | ScSynthNode | ScPluginNode, NodeState> implements IScNode {
    static properties = {
        name: {type: String, reflect: true},
        run: {type: Boolean, reflect: true},
    };

    declare name: string;
    declare run: boolean;
    readonly nodeId = oscService.nextNodeId();
    protected _loaded = false;
    private _provider!: ContextProvider<{ __context__: NodeContext }, this>;
    protected _consumer!: ContextConsumer<{ __context__: NodeContext }, this>;
    private _prevParentEnabled = false;

    constructor() {
        super();
        this.run = true;
        this._provider = new ContextProvider(this, {context: nodeContext, initialValue: undefined});
        this._consumer = new ContextConsumer(this, {
            context: nodeContext,
            subscribe: true,
            callback: (ctx) => {
                const enabled = ctx?.loaded ?? false;
                if (enabled !== this._prevParentEnabled) {
                    this._prevParentEnabled = enabled;
                    this._onParentEnabledChanged(enabled);
                }
            },
        });

    }

    protected _subscribe(): () => void {
        let prev = this._state.loaded;
        return store.subscribe(() => {
            const next = this._state.loaded;
            if (next !== prev) {
                prev = next;
                this._provider.setValue(this._state as NodeState, true);
            }
        });
    }

    getState(state: RuntimeState): NodeState {
        const el = state.nodes[this.id];
        if (!el || !isNode(el)) return EMPTY_STATE;
        const controls: Record<string, number> = {};
        if (isParent(el)) {
            for (const child of el.children) {
                if (isControl(child) && child.value != null) {
                    controls[child.name] = child.runtime.value;
                }
            }
        }
        return {nodeId: el.runtime.nodeId, loaded: el.runtime.loaded, run: el.runtime.run, controls};
    }

    getControls(): Record<string, number> {
        return {...this._state.controls};
    }

    protected get groupId(): number {
        return this._consumer.value?.nodeId ?? oscService.defaultGroupId();
    }

    protected _onParentEnabledChanged(_enabled: boolean): void {
        // Override in subclasses to react to parent enabled changes
    }

    render() {
        return html`<slot></slot>`;
    }
}
