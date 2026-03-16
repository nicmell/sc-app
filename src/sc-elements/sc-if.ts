import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext} from './context.ts';

export class ScIf extends LitElement {
  static properties = {
    bind: {type: String},
    isTruthy: {type: String, attribute: 'is-truthy'},
    isFalsy: {type: String, attribute: 'is-falsy'},
    isEqual: {type: String, attribute: 'is-equal'},
    isNotEqual: {type: String, attribute: 'is-not-equal'},
    isGreaterThan: {type: String, attribute: 'is-greater-than'},
    isLesserThan: {type: String, attribute: 'is-lesser-than'},
  };

  declare bind: string;
  declare isTruthy: string | null;
  declare isFalsy: string | null;
  declare isEqual: string | null;
  declare isNotEqual: string | null;
  declare isGreaterThan: string | null;
  declare isLesserThan: string | null;

  private _node = new ContextConsumer(this, {context: nodeContext, subscribe: true});

  static styles = css`
    :host { display: contents; }
    :host([hidden]) { display: none; }
  `;

  constructor() {
    super();
    this.bind = '';
    this.isTruthy = null;
    this.isFalsy = null;
    this.isEqual = null;
    this.isNotEqual = null;
    this.isGreaterThan = null;
    this.isLesserThan = null;
  }

  private _test(): boolean {
    const value = this._node.value?.getBindValue(this.bind);
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

    this.toggleAttribute('hidden', !this._shouldShow(pass, hasTruthy, hasFalsy));

    if (hasTruthy && hasFalsy) {
      const text = pass ? this.isTruthy : this.isFalsy;
      return text ? html`${text}` : html`<slot></slot>`;
    }

    if (hasTruthy) {
      return this.isTruthy ? html`${this.isTruthy}` : html`<slot></slot>`;
    }

    if (hasFalsy) {
      return this.isFalsy ? html`${this.isFalsy}` : html`<slot></slot>`;
    }

    return html`<slot></slot>`;
  }

  private _shouldShow(pass: boolean, hasTruthy: boolean, hasFalsy: boolean): boolean {
    if (hasTruthy && hasFalsy) return true;
    if (hasTruthy) return pass;
    if (hasFalsy) return !pass;
    return pass;
  }
}
