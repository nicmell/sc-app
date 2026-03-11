import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {nodeRunMessage, nodeSetMessage} from '@/lib/osc/messages.ts';
import {layoutApi} from '@/lib/stores/api';
import {store} from '@/lib/stores/store';
import {nodeContext, type NodeContext, type ScNode as IScNode, type ScElement} from '../context.ts';


export abstract class ScNode extends LitElement implements IScNode {
    static properties = {
        name: {type: String, reflect: true},
    };

    declare name: string;
    readonly nodeId: number;
    protected _oscCreated = false;
    protected registeredElements = new Set<ScElement>();
    protected _parent!: ContextConsumer<{ __context__: NodeContext }, this>;

    abstract get isRunning(): boolean;

    get boxId(): string {
        return this._parent.value?.boxId ?? this.id;
    }

    get path() {
        return this._parent.value ? [this._parent.value.path, this.name].join(".") : this.name
    }

    get pathSegments(): string[] {
        return this.path.split(".").slice(1);
    }

    get state() {
        return layoutApi.elementState(this.boxId, this.pathSegments);
    }

    registerElement(el: ScElement) {
        this.registeredElements.add(el);
    }

    unregisterElement(el: ScElement) {
        this.registeredElements.delete(el);
    }

    onChange(target: string, value: number) {
        const segments = [...this.pathSegments, ...target.split(".")];
        const path = segments.slice(0, -1);
        const control = segments[segments.length - 1];
        layoutApi.setControl({boxId: this.boxId, path, controls: {[control]: value}});
        oscService.send(nodeSetMessage(this.nodeId, {[control]: value}));
    }

    onRun(isRunning: boolean) {
        layoutApi.setRunning({boxId: this.boxId, path: this.pathSegments, isRunning});
        oscService.send(nodeRunMessage(this.nodeId, isRunning ? 1 : 0));
    }

    protected get groupId(): number {
        return this._parent.value?.nodeId ?? oscService.defaultGroupId();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._parent.value?.unregisterElement(this);
    }

    constructor() {
        super();
        this.nodeId = oscService.nextNodeId();
        this._parent = new ContextConsumer(this, {
            context: nodeContext, subscribe: false,
            callback: (ctx) => ctx?.registerElement(this),
        });

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;
        const ctx: NodeContext = {
            get boxId() {
                return self.boxId;
            },
            nodeId: this.nodeId,
            get path() {
                return self.path
            },
            get loaded() {
                return self._oscCreated;
            },
            get running() {
                return self.isRunning;
            },
            get state() {
                return self.state;
            },
            registerElement: (el) => this.registerElement(el),
            unregisterElement: (el) => this.unregisterElement(el),
            onChange: (target, value) => this.onChange(target, value),
            onRun: (isRunning) => this.onRun(isRunning),
        };
        const provider = new ContextProvider(this, {context: nodeContext, initialValue: ctx});
        store.subscribe(() => {
            provider.setValue(ctx, true);
        });
    }


    render() {
        return html`
            <slot></slot>`;
    }
}
