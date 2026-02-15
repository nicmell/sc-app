import {LitElement, html} from 'lit';
import {ContextProvider} from '@lit/context';
import {oscService} from '@/lib/osc';
import {createSynthMessage, createFreeNodeMessage, createNodeRunMessage, createGroupTailMessage} from '@/lib/osc/messages.ts';
import {nodeIdContext} from './context.ts';

export class ScSynth extends LitElement {
  static properties = {
    name: {type: String},
  };

  declare name: string;

  readonly nodeId: number;

  constructor() {
    super();
    this.name = 'default';
    this.nodeId = oscService.nextNodeId();
    new ContextProvider(this, {context: nodeIdContext, initialValue: this.nodeId});
  }

  connectedCallback() {
    super.connectedCallback();
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
