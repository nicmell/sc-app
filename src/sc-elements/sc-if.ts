import {html, css} from 'lit';
import type {ScIfNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isVisual, isControl} from '@/lib/utils/guards';
import {ScElement} from './internal/sc-element.ts';

export class ScIf extends ScElement<ScIfNode, number> {
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

  static styles = css`
    :host { display: contents; }
    :host([hidden]) { display: none; }
  `;

  getState(state: RuntimeState): number {
    const self = state.nodes[this.id];
    if (!self || !isVisual(self)) return 0;
    const control = state.nodes[self.runtime.targetId];
    return control && isControl(control) ? control.runtime.value : 0;
  }

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
    const value = this._state;
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
