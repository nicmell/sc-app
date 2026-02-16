import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {
  newGroupMessage,
  groupTailMessage,
  groupFreeAllMessage,
  nodeSetMessage,
  nodeRunMessage,
  freeNodeMessage
} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {nodeContext, type NodeContext, type ScNode, type ScElement} from './context.ts';

export class ScGroup extends LitElement {
  readonly nodeId: number;
  private registeredNodes = new Set<ScNode>();
  private registeredElements = new Set<ScElement>();
  private _group!: ContextConsumer<{__context__: NodeContext}, this>;

  get loaded() {
    return nodesApi.items.some(n => n.nodeId === this.nodeId);
  }

  get isRunning() {
    return false;
  }

  get params(): Record<string, number> {
    return {};
  }

  registerElement(el: ScElement) {
    this.registeredElements.add(el);
  }

  unregisterElement(el: ScElement) {
    this.registeredElements.delete(el);
  }

  registerNode(node: ScNode) {
    this.registeredNodes.add(node);
  }

  unregisterNode(node: ScNode) {
    this.registeredNodes.delete(node);
  }

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
    this.nodeId = oscService.nextNodeId();

    this._group = new ContextConsumer(this, {context: nodeContext, subscribe: false});

    const ctx: NodeContext = {
      type: 'group',
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
    const group = this._group.value;
    const groupId = group?.nodeId ?? oscService.defaultGroupId();
    group?.registerNode(this);
    nodesApi.newGroup({nodeId: this.nodeId, groupId});
    oscService.send(
        newGroupMessage(this.nodeId),
        groupTailMessage(groupId, -1),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._group.value?.unregisterNode(this);
    if (this.loaded) {
      nodesApi.freeNode(this.nodeId);
      oscService.send(
          groupFreeAllMessage(this.nodeId),
          freeNodeMessage(this.nodeId)
      );
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
