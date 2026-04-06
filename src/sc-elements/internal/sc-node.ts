import {html} from 'lit';
import {ContextProvider} from '@lit/context';
import {oscService} from '@/lib/osc';
import {isControl, isNode} from '@/lib/utils/guards';
import type {ScGroupNode, ScSynthNode, ScPluginNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {nodeContext, type NodeContext} from '../context.ts';
import {ScElement} from './sc-element.ts';

type ScNodeElement = ScGroupNode | ScSynthNode | ScPluginNode;

export abstract class ScNode<T extends ScNodeElement = ScNodeElement> extends ScElement<T, T | undefined> {
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

    getState(state: RuntimeState): T | undefined {
        const el = state.nodes[this.id];
        return el && isNode(el) ? el as T : undefined;
    }

    protected get groupId(): number {
        return this._parent?.runtime.nodeId ?? oscService.defaultGroupId();
    }

    getControls(): Record<string, number> {
        return Object.fromEntries(
            (this._state?.children ?? [])
                .filter((c): c is import('@/types/parsers').ScControlNode => isControl(c) && c.value != null)
                .map(c => [c.name, c.runtime.value])
        );
    }

    render() {
        return html`<slot></slot>`;
    }
}
