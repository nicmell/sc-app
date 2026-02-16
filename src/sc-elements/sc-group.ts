import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {createGroupMessage, createGroupTailMessage, createDeepFreeMessage, createNodeRunMessage, createNodeSetMessage} from '@/lib/osc/messages.ts';
import {groupsApi} from '@/lib/stores/api';
import {nodeContext, type NodeContext, type ScNode, type ScElement} from './context.ts';

export class ScGroup extends LitElement {
  readonly nodeId: number;
  private registeredNodes = new Set<ScNode>();
  private registeredElements = new Set<ScElement>();
  private _node!: ContextConsumer<{__context__: NodeContext}, this>;

  constructor() {
    super();
    this.nodeId = oscService.nextNodeId();

    this._node = new ContextConsumer(this, {context: nodeContext, subscribe: false});

    const nodeId = this.nodeId;
    const ctx: NodeContext = {
      nodeId,
      get loaded() {
        return groupsApi.items.some(g => g.nodeId === nodeId);
      },
      get running() {
        return groupsApi.items.find(g => g.nodeId === nodeId)?.isRunning ?? false;
      },
      get params() {
        return groupsApi.items.find(g => g.nodeId === nodeId)?.params ?? {};
      },
      registerElement: (el) => this.registeredElements.add(el),
      unregisterElement: (el) => this.registeredElements.delete(el),
      registerNode: (node) => this.registeredNodes.add(node),
      unregisterNode: (node) => this.registeredNodes.delete(node),
      onChange: (el) => {
        const params = el.getParams();
        groupsApi.setParams({nodeId: this.nodeId, params});
        oscService.send(createNodeSetMessage(this.nodeId, params));
      },
      onRun: (isRunning) => {
        groupsApi.setRunning({nodeId: this.nodeId, isRunning});
        oscService.send(createNodeRunMessage(this.nodeId, isRunning ? 1 : 0));
      },
    };
    new ContextProvider(this, {context: nodeContext, initialValue: ctx});
  }

  protected firstUpdated() {
    const params: Record<string, number> = {};
    for (const el of this.registeredElements) {
      Object.assign(params, el.getParams());
    }
    groupsApi.newGroup({nodeId: this.nodeId, params});

    const parent = this._node.value;
    parent?.registerNode(this);
    oscService.send(
        createGroupMessage(this.nodeId),
        // createNodeRunMessage(-1, 0),
        createGroupTailMessage(oscService.defaultGroupId(), -1),
        parent ? createGroupTailMessage(parent.nodeId, -1) : undefined,
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._node.value?.unregisterNode(this);
    if (this.nodeId) {
      groupsApi.freeGroup(this.nodeId);
      oscService.send(createDeepFreeMessage(this.nodeId));
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
