import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {nodeRunMessage, nodeSetMessage} from '@/lib/osc/messages.ts';
import {runtimeApi} from '@/lib/stores/api';
import {isSynth} from '@/lib/utils/guards';
import {findElementById} from '@/lib/utils/elementTree';
import {store} from '@/lib/stores/store';
import {nodeContext, type NodeContext, type ScNode as IScNode, type ScElement} from '../context.ts';


export abstract class ScNode extends LitElement implements IScNode {
    static properties = {
        name: {type: String, reflect: true},
        running: {type: Boolean, reflect: true},
    };

    declare name: string;
    declare running: boolean;
    readonly nodeId = oscService.nextNodeId();
    protected _loaded = false;
    protected registeredElements = new Set<ScElement>();
    protected _parent!: ContextConsumer<{ __context__: NodeContext }, this>;
    private _unsubscribe!: () => void;

    boxId(): string {
        return this._parent.value?.boxId() ?? this.id;
    }

    getParams(): Record<string, number> {
        const plugin = runtimeApi.getById(this.boxId());
        if (!plugin) return {};
        const el = findElementById(plugin.children, this.id);
        if (!el || !isSynth(el)) return {};
        const values = runtimeApi.values;
        const params: Record<string, number> = {};
        for (const [name, entryId] of Object.entries(el.runtime.controls)) {
            const entry = values[entryId];
            if (entry && entry.type === 'control') {
                params[name] = entry.value;
            }
        }
        return params;
    }

    registerElement(el: ScElement) {
        this.registeredElements.add(el);
    }

    unregisterElement(el: ScElement) {
        this.registeredElements.delete(el);
    }

    onChange(entryId: string, target: string, value: number) {
        runtimeApi.setControl({entryId, value});
        const segments = target.split('.');
        const control = segments.pop()!;
        const nodeId = this.resolveNodeId(segments);
        oscService.send(nodeSetMessage(nodeId, {[control]: value}));
    }

    onRun(entryId: string, target: string, value: number) {
        runtimeApi.setRunning({entryId, value});
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

    getInputValue(entryId: string): number | undefined {
        const values = runtimeApi.values;
        const entry = values[entryId];
        if (!entry) return undefined;
        if (entry.type === 'control' || entry.type === 'run') return entry.value;
        return undefined;
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
        this.running = true;
        this._parent = new ContextConsumer(this, {
            context: nodeContext, subscribe: false,
            callback: (ctx) => ctx?.registerElement(this),
        });

        const ctx: NodeContext = {
            nodeId: this.nodeId,
            boxId: () => this.boxId(),
            registerElement: (el) => this.registerElement(el),
            unregisterElement: (el) => this.unregisterElement(el),
            onChange: (entryId, target, value) => this.onChange(entryId, target, value),
            onRun: (entryId, target, value) => this.onRun(entryId, target, value),
            getInputValue: (entryId) => this.getInputValue(entryId),
        };
        const provider = new ContextProvider(this, {context: nodeContext, initialValue: ctx});
        let prevValues = store.getState().runtime.values;
        this._unsubscribe = store.subscribe(() => {
            const values = store.getState().runtime.values;
            if (values !== prevValues) {
                prevValues = values;
                provider.setValue(ctx, true);
            }
        });
    }


    render() {
        return html`
            <slot></slot>`;
    }
}
