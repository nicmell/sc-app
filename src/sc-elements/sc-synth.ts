import {LitElement, html} from 'lit';
import {ContextProvider} from '@lit/context';
import {oscService} from '@/lib/osc';
import {createSynthMessage, createFreeNodeMessage, createNodeRunMessage, createNodeSetMessage, createGroupTailMessage} from '@/lib/osc/messages.ts';
import {logger} from '@/lib/logger';
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
        logger.log(`[sc-synth:${this.nodeId}] ${el.tagName.toLowerCase()} changed: ${JSON.stringify(params)}`);
        oscService.send(createNodeSetMessage(this.nodeId, params));
      },
      onRun: (isRunning) => {
        oscService.send(createNodeRunMessage(this.nodeId, isRunning ? 1 : 0));
        logger.log(`[sc-synth:${this.nodeId}] run: ${isRunning}`);
      },
    };
    new ContextProvider(this, {context: synthContext, initialValue: ctx});
  }

  protected firstUpdated() {
    for (const el of this.registeredElements) {
      const tag = el.tagName.toLowerCase();
      logger.log(`[sc-synth:${this.nodeId}] ${tag} defaults: ${JSON.stringify(el.getParams())}`);
    }
    oscService.send(
      createSynthMessage(this.name, this.nodeId),
      createNodeRunMessage(-1, 0),
      createGroupTailMessage(oscService.defaultGroupId(), -1),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.nodeId) {
      oscService.send(createFreeNodeMessage(this.nodeId));
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
