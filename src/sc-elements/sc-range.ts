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
  };

  declare param: string;
  declare min: number;
  declare max: number;
  declare step: number;
  declare value: number;

  protected _synth = new ContextConsumer(this, {context: synthContext, subscribe: true,
    callback: (ctx) => ctx?.register(this),
  });

  static styles = css`
    :host { display: block; }
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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._synth.value?.unregister(this);
  }

  getParams(): Record<string, number> {
    return this.param ? {[this.param]: this.value} : {};
  }

  protected _ratio(): number {
    return (this.value - this.min) / (this.max - this.min);
  }

  protected _setValue(v: number) {
    v = Math.round((v - this.min) / this.step) * this.step + this.min;
    v = Math.max(this.min, Math.min(this.max, v));
    if (v !== this.value) {
      this.value = v;
      this._synth.value?.onChange(this);
    }
  }

  private _onInput(e: Event) {
    this.value = parseFloat((e.target as HTMLInputElement).value);
    this._synth.value?.onChange(this);
  }

  render() {
    return html`
      <input
        type="range"
        .min=${String(this.min)}
        .max=${String(this.max)}
        .step=${String(this.step)}
        .value=${String(this.value)}
        @input=${this._onInput}
      />
    `;
  }
}
