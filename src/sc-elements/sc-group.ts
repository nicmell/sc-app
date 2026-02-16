import {LitElement, html} from 'lit';
import {ContextProvider} from '@lit/context';
import {oscService} from '@/lib/osc';
import {createGroupMessage, createGroupTailMessage, createDeepFreeMessage} from '@/lib/osc/messages.ts';
import {groupsApi} from '@/lib/stores/api';
import {groupContext, type GroupContext, type ScNode} from './context.ts';

export class ScGroup extends LitElement {
  readonly nodeId: number;
  private registeredNodes = new Set<ScNode>();

  constructor() {
    super();
    this.nodeId = oscService.nextNodeId();

    const ctx: GroupContext = {
      nodeId: this.nodeId,
      register: (node) => this.registeredNodes.add(node),
      unregister: (node) => this.registeredNodes.delete(node),
    };
    new ContextProvider(this, {context: groupContext, initialValue: ctx});
  }

  protected firstUpdated() {
    groupsApi.newGroup(this.nodeId);
    oscService.send(
      createGroupMessage(this.nodeId),
      createGroupTailMessage(oscService.defaultGroupId(), this.nodeId),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.nodeId) {
      groupsApi.freeGroup(this.nodeId);
      oscService.send(createDeepFreeMessage(this.nodeId));
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
