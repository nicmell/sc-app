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

    onChange(targetNode: string, target: string, value: number) {
        const segments = target.split('.');
        const control = segments.pop()!;
        runtimeApi.setControl({nodeId: targetNode, name: control, value});
        const nodeId = this.resolveNodeId(segments);
        oscService.send(nodeSetMessage(nodeId, {[control]: value}));
    }

    onRun(targetNode: string, target: string, value: number) {
        runtimeApi.setRunning({nodeId: targetNode, value});
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

    getControlValue(targetNode: string, name: string): number | undefined {
        const node = runtimeApi.getById(targetNode);
        return node && isNode(node) ? node.runtime.controls[name] : undefined;
    }

    getRunValue(targetNode: string): number | undefined {
        const node = runtimeApi.getById(targetNode);
        return node && isNode(node) ? node.runtime.run : undefined;
    }

    protected get groupId(): number {
        return this._parent.value?.nodeId ?? oscService.defaultGroupId();
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
            context: nodeContext, subscribe: false,
            callback: (ctx) => ctx?.registerElement(this),
        });

        const ctx: NodeContext = {
            nodeId: this.nodeId,
            boxId: () => this.boxId(),
            registerElement: (el) => this.registerElement(el),
            unregisterElement: (el) => this.unregisterElement(el),
            onChange: (targetNode, target, value) => this.onChange(targetNode, target, value),
            onRun: (targetNode, target, value) => this.onRun(targetNode, target, value),
            getControlValue: (targetNode, name) => this.getControlValue(targetNode, name),
            getRunValue: (targetNode) => this.getRunValue(targetNode),
        };
        const provider = new ContextProvider(this, {context: nodeContext, initialValue: ctx});
        let prevNodes = store.getState().runtime.nodes;
        this._unsubscribe = store.subscribe(() => {
            const nodes = store.getState().runtime.nodes;
            if (nodes !== prevNodes) {
                prevNodes = nodes;
                provider.setValue(ctx, true);
            }
        });
    }


    render() {
        return html`
            <slot></slot>`;
    }
}
