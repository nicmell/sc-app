import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {synthContext} from './context.ts';

export class ScToggle extends LitElement {
  static properties = {
    label: {type: String},
    checked: {type: Boolean, reflect: true},
  };

  declare label: string;
  declare checked: boolean;

  private _synth = new ContextConsumer(this, {context: synthContext, subscribe: true});

  static styles = css`
    :host {
      display: inline-block;
      font-family: system-ui, sans-serif;
    }
    label {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 13px;
      color: var(--color-text, #e0e0e0);
    }
    input {
      accent-color: var(--color-primary, #0a6dc4);
    }
  `;

  constructor() {
    super();
    this.label = '';
    this.checked = false;
  }

  private _onChange(e: Event) {
    this.checked = (e.target as HTMLInputElement).checked;
    this._synth.value?.onRun(this.checked);
  }

  render() {
    return html`
      <label>
        <input type="checkbox" .checked=${this.checked} @change=${this._onChange} />
        ${this.label || (this.checked ? 'On' : 'Off')}
      </label>
    `;
  }
}
