import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {synthContext} from './context.ts';

export class ScToggle extends LitElement {
  static properties = {
    checked: {type: Boolean, reflect: true},
  };

  declare checked: boolean;

  private _synth = new ContextConsumer(this, {context: synthContext, subscribe: true});

  static styles = css`
    :host { display: inline-block; }
    input { accent-color: var(--color-primary, #0a6dc4); }
  `;

  constructor() {
    super();
    this.checked = false;
  }

  private _onChange(e: Event) {
    this.checked = (e.target as HTMLInputElement).checked;
    this._synth.value?.onRun(this.checked);
  }

  render() {
    return html`<input type="checkbox" .checked=${this.checked} @change=${this._onChange} />`;
  }
}
