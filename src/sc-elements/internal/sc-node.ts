import {html} from 'lit';
import {ContextProvider} from '@lit/context';
import {oscService} from '@/lib/osc';
import {isControl, isNode, isBuffer} from '@/lib/utils/guards';
import type {ScNodeItem, ScControlItem} from '@/types/parsers';
import {runtimeApi} from '@/lib/stores/api';
import type {RuntimeState} from '@/types/stores';
import {nodeContext, type NodeContext} from '../context.ts';
import {ScElement} from './sc-element.ts';

export abstract class ScNode<T extends ScNodeItem = ScNodeItem, S = T | undefined> extends ScElement<T, S> {
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
        this._provider.setValue(this._contextValue(), true);
    }

    getState(state: RuntimeState): S {
        const el = state.nodes[this.id];
        return (el && isNode(el) ? el as T : undefined) as S;
    }

    /** The `ScNodeItem` to publish to child context-consumers. Subclasses
     *  with a richer `_state` shape override this to return just the item. */
    protected _contextValue(): NodeContext {
        return this._state as unknown as NodeContext;
    }

    /** The node item backing `_state`. Subclasses with a richer state shape
     *  override this to extract the item from their state object. */
    protected _nodeItem(): T | undefined {
        return this._state as unknown as T | undefined;
    }

    protected get groupId(): number {
        return this._parent?.runtime.nodeId ?? oscService.defaultGroupId();
    }

    getControls(): Record<string, number> {
        const item = this._nodeItem();
        return Object.fromEntries(
            (item?.children ?? [])
                .filter((c): c is ScControlItem => isControl(c))
                .map(c => {
                    if (c.runtime.targets) {
                        for (const targetId of Object.values(c.runtime.targets)) {
                            const target = runtimeApi.getById(targetId);
                            if (target && isBuffer(target)) {
                                return [c.name, target.runtime.bufnum];
                            }
                        }
                    }
                    return [c.name, c.runtime.value];
                })
        );
    }

    render() {
        return html`<slot></slot>`;
    }
}
