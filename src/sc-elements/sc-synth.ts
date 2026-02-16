import {LitElement, html} from 'lit';
import {ContextProvider} from '@lit/context';
import {oscService} from '@/lib/osc';
import {createSynthMessage, createFreeNodeMessage, createNodeRunMessage, createNodeSetMessage, createGroupTailMessage} from '@/lib/osc/messages.ts';
import {synthsApi} from '@/lib/stores/api';
import {synthContext, type SynthContext, type ScElement} from './context.ts';

export class ScSynth extends LitElement {
  static properties = {
    name: {type: String},
  };

  declare name: string;

  readonly nodeId: number;
  private registeredElements = new Set<ScElement>();

  constructor() {
    super();
    this.name = 'default';
    this.nodeId = oscService.nextNodeId();

    const ctx: SynthContext = {
      nodeId: this.nodeId,
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
  }

  protected firstUpdated() {
    const params: Record<string, number> = {};
    for (const el of this.registeredElements) {
      Object.assign(params, el.getParams());
    }
    synthsApi.newSynth({nodeId: this.nodeId, params});
    oscService.send(
      createSynthMessage(this.name, this.nodeId, 0, 0, params),
      createNodeRunMessage(-1, 0),
      createGroupTailMessage(oscService.defaultGroupId(), -1),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.nodeId) {
      synthsApi.freeSynth(this.nodeId);
      oscService.send(createFreeNodeMessage(this.nodeId));
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
