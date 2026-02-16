import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {createSynthMessage, createFreeNodeMessage, createNodeRunMessage, createNodeSetMessage, createGroupTailMessage} from '@/lib/osc/messages.ts';
import {synthsApi} from '@/lib/stores/api';
import {nodeContext, type NodeContext, type ScElement} from './context.ts';

export class ScSynth extends LitElement {
  static properties = {
    name: {type: String},
  };

  declare name: string;

  readonly nodeId: number;
  private registeredElements = new Set<ScElement>();
  private _node!: ContextConsumer<{__context__: NodeContext}, this>;

  constructor() {
    super();
    this.name = 'default';
    this.nodeId = oscService.nextNodeId();

    this._node = new ContextConsumer(this, {context: nodeContext, subscribe: false});

    const nodeId = this.nodeId;
    const ctx: NodeContext = {
      nodeId,
      get loaded() {
        return synthsApi.items.some(s => s.nodeId === nodeId);
      },
      get running() {
        return synthsApi.items.find(s => s.nodeId === nodeId)?.isRunning ?? false;
      },
      get params() {
        return synthsApi.items.find(s => s.nodeId === nodeId)?.params ?? {};
      },
      registerElement: (el) => this.registeredElements.add(el),
      unregisterElement: (el) => this.registeredElements.delete(el),
      registerNode: () => {},
      unregisterNode: () => {},
      onChange: (el) => {
        const params = el.getParams();
        synthsApi.setParams({nodeId: this.nodeId, params});
        oscService.send(createNodeSetMessage(this.nodeId, params));
      },
      onRun: (isRunning) => {
        synthsApi.setRunning({nodeId: this.nodeId, isRunning});
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
    synthsApi.newSynth({nodeId: this.nodeId, params});

    const parent = this._node.value;
    parent?.registerNode(this);
    oscService.send(
      createSynthMessage(this.name, this.nodeId, 0, 0, params),
      createNodeRunMessage(-1, 0),
      createGroupTailMessage(oscService.defaultGroupId(), -1),
      parent ? createGroupTailMessage(parent.nodeId, -1) : undefined,
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._node.value?.unregisterNode(this);
    if (this.nodeId) {
      synthsApi.freeSynth(this.nodeId);
      oscService.send(createFreeNodeMessage(this.nodeId));
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
