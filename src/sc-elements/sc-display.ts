import {html, css} from 'lit';
import type {ScDisplayItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isVisual, isControl, isVar} from '@/lib/utils/guards';
import {ScElement} from './internal/sc-element.ts';

function formatValue(template: string, value: unknown): string {
  if (typeof value === 'boolean') return template.replace('%b', value ? 'true' : 'false');
  if (typeof value === 'string') return template.replace('%s', value);
  if (typeof value === 'number') {
    return template.replace(/%(?:\.(\d+))?([df])/, (_, precision, type) => {
      if (type === 'f' && precision) return value.toFixed(parseInt(precision));
      if (type === 'd') return Math.round(value).toString();
      return String(value);
    });
  }
  return String(value ?? '');
}

export class ScDisplay extends ScElement<ScDisplayItem, number> {
  static properties = {
    bind: {type: String},
    format: {type: String},
  };

  declare bind: string;
  declare format: string;

  static styles = css`
    :host {
      display: inline;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      color: var(--color-text, #e0e0e0);
    }
  `;

  getState(state: RuntimeState): number {
    const self = state.nodes[this.id];
    if (!self || !isVisual(self)) return 0;
    const target = state.nodes[self.runtime.targetId];
    if (target && isControl(target)) return target.runtime.value;
    if (target && isVar(target)) return target.runtime.value;
    return 0;
  }

  constructor() {
    super();
    this.bind = '';
    this.format = '';
  }

  render() {
    const value = this._state;
    const text = this.format ? formatValue(this.format, value) : String(value ?? '');
    return html`${text}`;
  }
}
