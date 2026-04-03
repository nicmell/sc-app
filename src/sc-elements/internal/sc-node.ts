import {html} from 'lit';
import {ContextProvider} from '@lit/context';
import {oscService} from '@/lib/osc';
import {isNode, isParent, isControl} from '@/lib/utils/guards';
import type {ScGroupNode, ScSynthNode, ScPluginNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {nodeContext, type NodeContext, type NodeState} from '../context.ts';
import {ScElement} from './sc-element.ts';

export type {NodeState};

const EMPTY_STATE: NodeState = {nodeId: 0, loaded: false, run: 0, controls: {}};

export abstract class ScNode extends ScElement<ScGroupNode | ScSynthNode | ScPluginNode, NodeState> {
    static properties = {
        name: {type: String, reflect: true},
        run: {type: Boolean, reflect: true},
    };

    declare name: string;
    declare run: boolean;
    readonly nodeId = oscService.nextNodeId();
    private _provider!: ContextProvider<{ __context__: NodeContext }, this>;

    constructor() {
        super();
        this.run = true;
        this._provider = new ContextProvider(this, {context: nodeContext, initialValue: undefined});
    }

    protected updated() {
        this._provider.setValue(this._state, true);
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
        return this._parent?.nodeId ?? oscService.defaultGroupId();
    }

    render() {
        return html`<slot></slot>`;
    }
}
