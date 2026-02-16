import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {synthContext} from './context.ts';
import {StoreSubscriber} from './store-subscriber.ts';
import {get} from '@/lib/utils/get';

export class ScIf extends LitElement {
  static properties = {
    prop: {type: String},
    ifTruthy: {type: String, attribute: 'if-truthy'},
    ifFalsy: {type: String, attribute: 'if-falsy'},
    ifEqual: {type: String, attribute: 'if-equal'},
    ifNotEqual: {type: String, attribute: 'if-not-equal'},
    ifGreaterThan: {type: String, attribute: 'if-greater-than'},
    ifLesserThan: {type: String, attribute: 'if-lesser-than'},
  };

  declare prop: string;
  declare ifTruthy: string | null;
  declare ifFalsy: string | null;
  declare ifEqual: string | null;
  declare ifNotEqual: string | null;
  declare ifGreaterThan: string | null;
  declare ifLesserThan: string | null;

  private _synth = new ContextConsumer(this, {context: synthContext, subscribe: true});

  static styles = css`
    :host { display: contents; }
  `;

  constructor() {
    super();
    this.prop = '';
    this.ifTruthy = null;
    this.ifFalsy = null;
    this.ifEqual = null;
    this.ifNotEqual = null;
    this.ifGreaterThan = null;
    this.ifLesserThan = null;
    new StoreSubscriber(this, () => get(this._synth.value, this.prop));
  }

  private _test(): boolean {
    const value = get(this._synth.value, this.prop);
    const num = typeof value === 'number' ? value : Number(value);
    if (this.ifEqual !== null) return String(value) === this.ifEqual;
    if (this.ifNotEqual !== null) return String(value) !== this.ifNotEqual;
    if (this.ifGreaterThan !== null) return num > parseFloat(this.ifGreaterThan);
    if (this.ifLesserThan !== null) return num < parseFloat(this.ifLesserThan);
    return !!value;
  }

  render() {
    const pass = this._test();
    const hasTruthy = this.ifTruthy !== null;
    const hasFalsy = this.ifFalsy !== null;

    if (hasTruthy && hasFalsy) {
      const text = pass ? this.ifTruthy : this.ifFalsy;
      return text ? html`${text}` : html`<slot></slot>`;
    }

    if (hasTruthy) {
      if (!pass) return html``;
      return this.ifTruthy ? html`${this.ifTruthy}` : html`<slot></slot>`;
    }

    if (hasFalsy) {
      if (pass) return html``;
      return this.ifFalsy ? html`${this.ifFalsy}` : html`<slot></slot>`;
    }

    return pass ? html`<slot></slot>` : html``;
  }
}
