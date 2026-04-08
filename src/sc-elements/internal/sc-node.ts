import {html} from 'lit';
import {ContextProvider} from '@lit/context';
import {oscService} from '@/lib/osc';
import {isControl, isNode, isBuffer} from '@/lib/utils/guards';
import type {ScNodeItem, ScControlItem} from '@/types/parsers';
import {runtimeApi} from '@/lib/stores/api';
import type {RuntimeState} from '@/types/stores';
import {nodeContext, type NodeContext} from '../context.ts';
import {ScElement} from './sc-element.ts';

export abstract class ScNode<T extends ScNodeItem = ScNodeItem> extends ScElement<T, T | undefined> {
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
                .filter((c): c is ScControlItem => isControl(c))
                .map(c => {
                    let value = c.runtime.value;
                    if (c.runtime.targets) {
                        for (const targetId of Object.values(c.runtime.targets)) {
                            const target = runtimeApi.getById(targetId);
                            if (target && isBuffer(target)) {
                                value = target.runtime.bufnum;
                            }
                        }
                    }
                    return [c.name, value];
                })
        );
    }

    render() {
        return html`<slot></slot>`;
    }
}
