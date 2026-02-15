import {LitElement, html, css} from 'lit';
import {oscService} from '@/lib/osc';
import {createNodeRunMessage} from '@/lib/osc/messages.ts';

export class ScToggle extends LitElement {
  static properties = {
    'node-id': {type: Number, attribute: 'node-id'},
    label: {type: String},
    active: {type: Boolean, reflect: true},
  };

  declare 'node-id': number;
  declare label: string;
  declare active: boolean;

  static styles = css`
    :host {
      display: inline-block;
      font-family: system-ui, sans-serif;
    }
    button {
      background: #333;
      color: #e0e0e0;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 13px;
    }
    button:hover {
      background: #444;
    }
    :host([active]) button {
      background: #0a6dc4;
      border-color: #0a6dc4;
    }
  `;

  constructor() {
    super();
    this['node-id'] = 0;
    this.label = '';
    this.active = false;
  }

  private _onClick() {
    this.active = !this.active;
    const nodeId = this['node-id'];
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
