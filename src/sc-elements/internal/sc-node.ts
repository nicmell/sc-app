import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {nodeRunMessage, nodeSetMessage} from '@/lib/osc/messages.ts';
import {layoutApi} from '@/lib/stores/api';
import {findElementById} from '@/lib/parsers';
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

    onChange(elementId: string, target: string, value: number) {
        layoutApi.setControl({boxId: this.boxId, elementId, value});
        const segments = target.split('.');
        const control = segments.pop()!;
        const nodeId = this.resolveNodeId(segments);
        oscService.send(nodeSetMessage(nodeId, {[control]: value}));
    }

    onRun(elementId: string, target: string, value: number) {
        layoutApi.setRunning({boxId: this.boxId, elementId, value});
        const nodeId = this.resolveNodeId(target ? target.split('.') : []);
        oscService.send(nodeRunMessage(nodeId, value));
    }

    private resolveNodeId(segments: string[]): number {
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

    getNodeValue(elementId: string): number | undefined {
        const box = layoutApi.getById(this.boxId);
        if (!box?.elements) return undefined;
        const el = findElementById(box.elements, elementId);
        if (!el) return undefined;
        if (el.type === 'sc-range' || el.type === 'sc-checkbox' || el.type === 'sc-run') return el.value;
        return undefined;
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
            onChange: (elementId, target, value) => this.onChange(elementId, target, value),
            onRun: (elementId, target, value) => this.onRun(elementId, target, value),
            getNodeValue: (elementId) => this.getNodeValue(elementId),
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
