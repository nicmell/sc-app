import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {nodeRunMessage, nodeSetMessage} from '@/lib/osc/messages.ts';
import {runtimeApi} from '@/lib/stores/api';
import {isNode, findElementById} from '@/lib/parsers';
import {store} from '@/lib/stores/store';
import {nodeContext, type NodeContext, type ScNode as IScNode, type ScElement} from '../context.ts';


export abstract class ScNode extends LitElement implements IScNode {
    static properties = {
        name: {type: String, reflect: true},
    };

    declare name: string;
    readonly nodeId = oscService.nextNodeId();
    protected _loaded = false;
    protected registeredElements = new Set<ScElement>();
    protected _parent!: ContextConsumer<{ __context__: NodeContext }, this>;
    private _unsubscribe!: () => void;

    boxId(): string {
        return this._parent.value?.boxId() ?? this.id;
    }

    getControls(): Record<string, number> {
        const boxRuntime = runtimeApi.getBox(this.boxId());
        if (!boxRuntime?.elements) return {};
        const el = findElementById(boxRuntime.elements, this.id);
        if (!el || !isNode(el)) return {};
        const entries = runtimeApi.entries;
        const result: Record<string, number> = {};
        for (const [name, entryId] of Object.entries(el.runtime.controls)) {
            const entry = entries.find(e => e.id === entryId);
            if (entry) result[name] = entry.value;
        }
        return result;
    }

    registerElement(el: ScElement) {
        this.registeredElements.add(el);
    }

    unregisterElement(el: ScElement) {
        this.registeredElements.delete(el);
    }

    onChange(elementId: string, target: string, value: number) {
        runtimeApi.setControl({boxId: this.boxId(), elementId, value});
        const segments = target.split('.');
        const control = segments.pop()!;
        const nodeId = this.resolveNodeId(segments);
        oscService.send(nodeSetMessage(nodeId, {[control]: value}));
    }

    onRun(elementId: string, target: string, value: number) {
        runtimeApi.setRunning({boxId: this.boxId(), elementId, value});
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
        this._parent = new ContextConsumer(this, {
            context: nodeContext, subscribe: false,
            callback: (ctx) => ctx?.registerElement(this),
        });

        const ctx: NodeContext = {
            nodeId: this.nodeId,
            boxId: () => this.boxId(),
            registerElement: (el) => this.registerElement(el),
            unregisterElement: (el) => this.unregisterElement(el),
            onChange: (elementId, target, value) => this.onChange(elementId, target, value),
            onRun: (elementId, target, value) => this.onRun(elementId, target, value),
        };
        const provider = new ContextProvider(this, {context: nodeContext, initialValue: ctx});
        this._unsubscribe = store.subscribe(() => {
            provider.setValue(ctx, true);
        });
    }


    render() {
        return html`
            <slot></slot>`;
    }
}
