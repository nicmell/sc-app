import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {
  newSynthMessage,
  freeNodeMessage,
  nodeRunMessage,
  nodeSetMessage,
  groupTailMessage
} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {isSynth} from '@/lib/stores/nodes/slice';
import {nodeContext, type NodeContext, type ScNode, type ScElement} from './context.ts';

export class ScSynth extends LitElement {
  static properties = {
    name: {type: String},
  };

  declare name: string;

  readonly nodeId: number;
  private registeredElements = new Set<ScElement>();
  private _group!: ContextConsumer<{__context__: NodeContext}, this>;

  get loaded() {
    return nodesApi.items.some(n => n.nodeId === this.nodeId);
  }

  get isRunning() {
    const n = nodesApi.items.find(n => n.nodeId === this.nodeId);
    return n && isSynth(n) ? n.isRunning : false;
  }

  get params() {
    const n = nodesApi.items.find(n => n.nodeId === this.nodeId);
    return n && isSynth(n) ? n.params : {};
  }

  registerElement(el: ScElement) {
    this.registeredElements.add(el);
  }

  unregisterElement(el: ScElement) {
    this.registeredElements.delete(el);
  }

  registerNode(_node: ScNode) {}

  unregisterNode(_node: ScNode) {}

  onChange(el: ScElement) {
    const params = el.getParams();
    nodesApi.setParams({nodeId: this.nodeId, params});
    oscService.send(nodeSetMessage(this.nodeId, params));
  }

  onRun(isRunning: boolean) {
    nodesApi.setRunning({nodeId: this.nodeId, isRunning});
    oscService.send(nodeRunMessage(this.nodeId, isRunning ? 1 : 0));
  }

  constructor() {
    super();
    this.name = 'default';
    this.nodeId = oscService.nextNodeId();

    this._group = new ContextConsumer(this, {context: nodeContext, subscribe: false});

    const ctx: NodeContext = {
      type: 'synth',
      nodeId: this.nodeId,
      get loaded() { return self.loaded; },
      get running() { return self.isRunning; },
      get params() { return self.params; },
      registerElement: (el) => this.registerElement(el),
      unregisterElement: (el) => this.unregisterElement(el),
      registerNode: (node) => this.registerNode(node),
      unregisterNode: (node) => this.unregisterNode(node),
      onChange: (el) => this.onChange(el),
      onRun: (isRunning) => this.onRun(isRunning),
    };
    const self = this;
    new ContextProvider(this, {context: nodeContext, initialValue: ctx});
  }

  protected firstUpdated() {
    const params: Record<string, number> = {};
    for (const el of this.registeredElements) {
      Object.assign(params, el.getParams());
    }

    const group = this._group.value;
    const groupId = group?.nodeId ?? oscService.defaultGroupId();
    group?.registerNode(this);
    nodesApi.newSynth({nodeId: this.nodeId, groupId, params});
    oscService.send(
      newSynthMessage(this.name, this.nodeId, 0, 0, params),
      nodeRunMessage(-1, 0),
      groupTailMessage(groupId, -1),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._group.value?.unregisterNode(this);
    if (this.loaded) {
      nodesApi.freeNode(this.nodeId);
      oscService.send(freeNodeMessage(this.nodeId));
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
