import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {synthContext} from './context.ts';
import {StoreSubscriber} from './store-subscriber.ts';
import {get} from '@/lib/utils/get';

export class ScIf extends LitElement {
  static properties = {
    prop: {type: String},
    isTruthy: {type: String, attribute: 'is-truthy'},
    isFalsy: {type: String, attribute: 'is-falsy'},
    isEqual: {type: String, attribute: 'is-equal'},
    isNotEqual: {type: String, attribute: 'is-not-equal'},
    isGreaterThan: {type: String, attribute: 'is-greater-than'},
    isLesserThan: {type: String, attribute: 'is-lesser-than'},
  };

  declare prop: string;
  declare isTruthy: string | null;
  declare isFalsy: string | null;
  declare isEqual: string | null;
  declare isNotEqual: string | null;
  declare isGreaterThan: string | null;
  declare isLesserThan: string | null;

  private _synth = new ContextConsumer(this, {context: synthContext, subscribe: true});

  static styles = css`
    :host { display: contents; }
  `;

  constructor() {
    super();
    this.prop = '';
    this.isTruthy = null;
    this.isFalsy = null;
    this.isEqual = null;
    this.isNotEqual = null;
    this.isGreaterThan = null;
    this.isLesserThan = null;
    new StoreSubscriber(this, () => get(this._synth.value, this.prop));
  }

  private _test(): boolean {
    const value = get(this._synth.value, this.prop);
    const num = typeof value === 'number' ? value : Number(value);
    if (this.isEqual !== null) return String(value) === this.isEqual;
    if (this.isNotEqual !== null) return String(value) !== this.isNotEqual;
    if (this.isGreaterThan !== null) return num > parseFloat(this.isGreaterThan);
    if (this.isLesserThan !== null) return num < parseFloat(this.isLesserThan);
    return !!value;
  }

  render() {
    const pass = this._test();
    const hasTruthy = this.isTruthy !== null;
    const hasFalsy = this.isFalsy !== null;

    if (hasTruthy && hasFalsy) {
      const text = pass ? this.isTruthy : this.isFalsy;
      return text ? html`${text}` : html`<slot></slot>`;
    }

    if (hasTruthy) {
      if (!pass) return html``;
      return this.isTruthy ? html`${this.isTruthy}` : html`<slot></slot>`;
    }

    if (hasFalsy) {
      if (pass) return html``;
      return this.isFalsy ? html`${this.isFalsy}` : html`<slot></slot>`;
    }

    return pass ? html`<slot></slot>` : html``;
  }
}
