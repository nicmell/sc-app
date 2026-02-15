import {LitElement, html, css} from 'lit';
import {oscService} from '@/lib/osc';
import {createNodeSetMessage} from '@/lib/osc/messages.ts';

export class ScFader extends LitElement {
  static properties = {
    'node-id': {type: Number, attribute: 'node-id'},
    param: {type: String},
    min: {type: Number},
    max: {type: Number},
    step: {type: Number},
    value: {type: Number},
    label: {type: String},
  };

  declare 'node-id': number;
  declare param: string;
  declare min: number;
  declare max: number;
  declare step: number;
  declare value: number;
  declare label: string;

  static styles = css`
    :host {
      display: block;
      font-family: system-ui, sans-serif;
      color: var(--color-text, #e0e0e0);
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
    }
    span {
      display: flex;
      justify-content: space-between;
    }
    input[type='range'] {
      width: 100%;
      cursor: pointer;
      accent-color: var(--color-primary, #0a6dc4);
    }
  `;

  constructor() {
    super();
    this['node-id'] = 0;
    this.param = '';
    this.min = 0;
    this.max = 1;
    this.step = 0.01;
    this.value = 0;
    this.label = '';
  }

  private _onInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    this.value = val;
    const nodeId = this['node-id'];
    if (nodeId && this.param) {
      oscService.send(createNodeSetMessage(nodeId, {[this.param]: val}));
    }
  }

  render() {
    return html`
      <label>
        <span>
          <span>${this.label || this.param}</span>
          <span>${this.value}</span>
        </span>
        <input
          type="range"
          .min=${String(this.min)}
          .max=${String(this.max)}
          .step=${String(this.step)}
          .value=${String(this.value)}
          @input=${this._onInput}
        />
      </label>
    `;
  }
}
