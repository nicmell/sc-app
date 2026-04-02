import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {nodeRunMessage, nodeSetMessage} from '@/lib/osc/messages.ts';
import {runtimeApi} from '@/lib/stores/api';
import {isNode} from '@/lib/utils/guards';
import {store} from '@/lib/stores/store';
import {nodeContext, type NodeContext, type ScNode as IScNode, type ScElement} from '../context.ts';


export abstract class ScNode extends LitElement implements IScNode {
    static properties = {
        name: {type: String, reflect: true},
        run: {type: Boolean, reflect: true},
    };

    declare name: string;
    declare run: boolean;
    readonly nodeId = oscService.nextNodeId();
    protected _loaded = false;
    protected registeredElements = new Set<ScElement>();
    protected _parent!: ContextConsumer<{ __context__: NodeContext }, this>;
    private _unsubscribe!: () => void;
    private _prevParentEnabled = false;

    boxId(): string {
        return this._parent.value?.boxId() ?? this.id;
    }

    getParams(): Record<string, number> {
        const el = runtimeApi.getById(this.id);
        if (!el || !isNode(el)) return {};
        return {...el.runtime.controls};
    }

    registerElement(el: ScElement) {
        this.registeredElements.add(el);
    }

    unregisterElement(el: ScElement) {
        this.registeredElements.delete(el);
    }

    onChange(targetId: string, target: string, value: number) {
        const segments = target.split('.');
        const control = segments.pop()!;
        runtimeApi.setControl({nodeId: targetId, name: control, value});
        const nodeId = this.resolveNodeId(segments);
        oscService.send(nodeSetMessage(nodeId, {[control]: value}));
    }

    onRun(targetId: string, target: string, value: number) {
        runtimeApi.setRunning({nodeId: targetId, value});
        const nodeId = this.resolveNodeId(target ? target.split('.') : []);
        oscService.send(nodeRunMessage(nodeId, value));
    }

    private resolveNodeId(segments: string[]): number {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let current: ScNode = this;
        for (const name of segments) {
            const child = [...current.registeredElements].find(
                (el): el is ScNode => el instanceof ScNode && el.name === name
            );
            if (!child) return current.nodeId;
            current = child;
        }
        return current.nodeId;
    }

    getControlValue(targetId: string, name: string): number | undefined {
        const node = runtimeApi.getById(targetId);
        return node && isNode(node) ? node.runtime.controls[name] : undefined;
    }

    getRunValue(targetId: string): number | undefined {
        const node = runtimeApi.getById(targetId);
        return node && isNode(node) ? node.runtime.run : undefined;
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
        this._parent.value?.unregisterElement(this);
    }

    constructor() {
        super();
        this.run = true;
        this._parent = new ContextConsumer(this, {
            context: nodeContext,
            subscribe: true,
            callback: (ctx) => {
                if (ctx) {
                    ctx.registerElement(this);
                }
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
            boxId: () => this.boxId(),
            registerElement: (el) => this.registerElement(el),
            unregisterElement: (el) => this.unregisterElement(el),
            onChange: (targetId, target, value) => this.onChange(targetId, target, value),
            onRun: (targetId, target, value) => this.onRun(targetId, target, value),
            getControlValue: (targetId, name) => this.getControlValue(targetId, name),
            getRunValue: (targetId) => this.getRunValue(targetId),
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
