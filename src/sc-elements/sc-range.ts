import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {synthContext, type ScElement} from './context.ts';

export class ScRange extends LitElement implements ScElement {
  static properties = {
    param: {type: String},
    min: {type: Number},
    max: {type: Number},
    step: {type: Number},
    value: {type: Number},
    label: {type: String},
  };

  declare param: string;
  declare min: number;
  declare max: number;
  declare step: number;
  declare value: number;
  declare label: string;

  private _synth = new ContextConsumer(this, {context: synthContext, subscribe: true,
    callback: (ctx) => ctx?.register(this),
  });

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
    this.param = '';
    this.min = 0;
    this.max = 1;
    this.step = 0.01;
    this.value = 0;
    this.label = '';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._synth.value?.unregister(this);
  }

  getParams(): Record<string, number> {
    return this.param ? {[this.param]: this.value} : {};
  }

  private _onInput(e: Event) {
    this.value = parseFloat((e.target as HTMLInputElement).value);
    this._synth.value?.onChange(this);
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
