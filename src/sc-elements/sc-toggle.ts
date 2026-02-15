import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {createNodeRunMessage} from '@/lib/osc/messages.ts';
import {nodeIdContext} from './context.ts';

export class ScToggle extends LitElement {
  static properties = {
    label: {type: String},
    active: {type: Boolean, reflect: true},
  };

  declare label: string;
  declare active: boolean;

  private _nodeId = new ContextConsumer(this, {context: nodeIdContext, subscribe: true});

  static styles = css`
    :host {
      display: inline-block;
      font-family: system-ui, sans-serif;
    }
    button {
      background: var(--color-surface, #333);
      color: var(--color-text, #e0e0e0);
      border: 1px solid var(--color-border, #555);
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover {
      background: var(--color-surface-active, #444);
    }
    :host([active]) button {
      background: var(--color-primary, #0a6dc4);
      border-color: var(--color-primary, #0a6dc4);
    }
  `;

  constructor() {
    super();
    this.label = '';
    this.active = false;
  }

  private _onClick() {
    this.active = !this.active;
    const nodeId = this._nodeId.value;
    if (nodeId) {
      oscService.send(createNodeRunMessage(nodeId, this.active ? 1 : 0));
    }
  }

  render() {
    return html`
      <button @click=${this._onClick}>
        ${this.label || (this.active ? 'On' : 'Off')}
      </button>
    `;
  }
}
