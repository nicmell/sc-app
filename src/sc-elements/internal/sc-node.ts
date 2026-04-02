import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {runtimeApi} from '@/lib/stores/api';
import {isNode, isParent, isControl} from '@/lib/utils/guards';
import {store} from '@/lib/stores/store';
import {nodeContext, type NodeContext, type ScNode as IScNode} from '../context.ts';


export abstract class ScNode extends LitElement implements IScNode {
    static properties = {
        name: {type: String, reflect: true},
        run: {type: Boolean, reflect: true},
    };

    declare name: string;
    declare run: boolean;
    readonly nodeId = oscService.nextNodeId();
    protected _loaded = false;
    protected _parent!: ContextConsumer<{ __context__: NodeContext }, this>;
    private _unsubscribe!: () => void;
    private _prevParentEnabled = false;

    getParams(): Record<string, number> {
        const el = runtimeApi.getById(this.id);
        if (!el || !isParent(el)) return {};
        const params: Record<string, number> = {};
        for (const child of el.children) {
            if (isControl(child) && child.value != null) {
                params[child.name] = child.runtime.value;
            }
        }
        return params;
    }

    protected get groupId(): number {
        return this._parent.value?.nodeId ?? oscService.defaultGroupId();
    }

    protected _onParentEnabledChanged(_enabled: boolean): void {
        // Override in subclasses to react to parent enabled changes
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._unsubscribe();
    }

    constructor() {
        super();
        this.run = true;
        this._parent = new ContextConsumer(this, {
            context: nodeContext,
            subscribe: true,
            callback: (ctx) => {
                const enabled = ctx?.enabled ?? false;
                if (enabled !== this._prevParentEnabled) {
                    this._prevParentEnabled = enabled;
                    this._onParentEnabledChanged(enabled);
                }
            },
        });

        const ctx: NodeContext = {
            nodeId: this.nodeId,
            enabled: false,
        };
        const provider = new ContextProvider(this, {context: nodeContext, initialValue: ctx});
        let prevNodes = store.getState().runtime.nodes;
        this._unsubscribe = store.subscribe(() => {
            const nodes = store.getState().runtime.nodes;
            if (nodes !== prevNodes) {
                prevNodes = nodes;
                const el = nodes[this.id];
                ctx.enabled = el && isNode(el) ? el.runtime.loaded : false;
                provider.setValue(ctx, true);
            }
        });
    }


    render() {
        return html`<slot></slot>`;
    }
}
