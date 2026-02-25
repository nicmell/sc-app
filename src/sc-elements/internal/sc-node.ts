import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {nodeRunMessage, nodeSetMessage} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {store, type RootState} from '@/lib/stores/store';
import {nodeContext, type NodeContext, type ScNode as IScNode, type ScElement} from '../context.ts';

export abstract class ScNode extends LitElement implements IScNode {
  static properties = {
    id: {type: String, reflect: true},
  };

  readonly nodeId: number;
  protected registeredElements = new Set<ScElement>();
  protected _parent!: ContextConsumer<{__context__: NodeContext}, this>;

  protected abstract get type(): 'synth' | 'group';
  abstract get isRunning(): boolean;
  abstract get params(): Record<string, number>;

  override get id(): string {
    const parentId = this._parent.value?.id;
    return parentId ? `${parentId}.${super.id}` : super.id;
  }

  override set id(value: string) {
    super.id = value;
  }

  get loaded() {
    return nodesApi.items.some(n => n.nodeId === this.nodeId);
  }

  get parent(): NodeContext | undefined {
    return this._parent.value;
  }

  registerElement(el: ScElement) {
    this.registeredElements.add(el);
  }

  unregisterElement(el: ScElement) {
    this.registeredElements.delete(el);
  }

  onChange(params: Record<string, number>) {
    nodesApi.setControl({nodeId: this.nodeId, params});
    oscService.send(nodeSetMessage(this.nodeId, params));
  }

  onRun(isRunning: boolean) {
    nodesApi.setRunning({nodeId: this.nodeId, isRunning});
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
      nodeId: this.nodeId,
      get id() { return self.id; },
      get type() { return self.type; },
      get parent() { return self.parent; },
      get loaded() { return self.loaded; },
      get running() { return self.isRunning; },
      get params() { return self.params; },
      registerElement: (el) => this.registerElement(el),
      unregisterElement: (el) => this.unregisterElement(el),
      onChange: (params) => this.onChange(params),
      onRun: (isRunning) => this.onRun(isRunning),
    };
    const provider = new ContextProvider(this, {context: nodeContext, initialValue: ctx});
    store.subscribe((state: RootState, prevState: RootState) => {
      const nextNodes = state.scsynth.nodes;
      const prevNodes = prevState.scsynth.nodes;
      const next = nextNodes.items.find(n => n.nodeId === this.nodeId);
      const prev = prevNodes.items.find(n => n.nodeId === this.nodeId);
      if (next !== prev || nextNodes.controls !== prevNodes.controls) {
        provider.setValue(ctx, true);
      }
    });
  }


  render() {
    return html`<slot></slot>`;
  }
}
