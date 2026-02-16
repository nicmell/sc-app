import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {createSynthMessage, createFreeNodeMessage, createNodeRunMessage, createNodeSetMessage, createGroupTailMessage} from '@/lib/osc/messages.ts';
import {synthsApi} from '@/lib/stores/api';
import {synthContext, type SynthContext, type ScElement, groupContext, type GroupContext} from './context.ts';

export class ScSynth extends LitElement {
  static properties = {
    name: {type: String},
  };

  declare name: string;

  readonly nodeId: number;
  private registeredElements = new Set<ScElement>();
  private _group!: ContextConsumer<{__context__: GroupContext}, this>;

  constructor() {
    super();
    this.name = 'default';
    this.nodeId = oscService.nextNodeId();

    const nodeId = this.nodeId;
    const ctx: SynthContext = {
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
      register: (el) => this.registeredElements.add(el),
      unregister: (el) => this.registeredElements.delete(el),
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
    new ContextProvider(this, {context: synthContext, initialValue: ctx});
    this._group = new ContextConsumer(this, {context: groupContext, subscribe: false});
  }

  protected firstUpdated() {
    const params: Record<string, number> = {};
    for (const el of this.registeredElements) {
      Object.assign(params, el.getParams());
    }
    synthsApi.newSynth({nodeId: this.nodeId, params});

    const group = this._group.value;
    group?.register(this);
    oscService.send(
      createSynthMessage(this.name, this.nodeId, 0, 0, params),
      createNodeRunMessage(-1, 0),
      createGroupTailMessage(oscService.defaultGroupId(), -1),
      group ? createGroupTailMessage(group.nodeId, -1) : undefined,
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._group.value?.unregister(this);
    if (this.nodeId) {
      synthsApi.freeSynth(this.nodeId);
      oscService.send(createFreeNodeMessage(this.nodeId));
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
