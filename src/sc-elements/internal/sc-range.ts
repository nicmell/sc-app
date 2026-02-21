import {html, css} from 'lit';
import {ScControl} from './sc-control.ts';

export class ScRange extends ScControl {
  static properties = {
    ...ScControl.properties,
    min: {type: Number},
    max: {type: Number},
    step: {type: Number},
    value: {type: Number},
  };

  declare min: number;
  declare max: number;
  declare step: number;
  declare value: number;

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
    this.min = 0;
    this.max = 1;
    this.step = 0.01;
    this.value = 0;
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
      this._notifyChange();
    }
  }

  private _onInput(e: Event) {
    this.value = parseFloat((e.target as HTMLInputElement).value);
    this._notifyChange();
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
