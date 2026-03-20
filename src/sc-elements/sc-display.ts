import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext} from './context.ts';
import {runtimeApi} from '@/lib/stores/api';
import {findElementById} from '@/lib/utils/elementTree';
import type {ScDisplayNode} from '@/types/parsers';

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

export class ScDisplay extends LitElement {
  static properties = {
    bind: {type: String},
    format: {type: String},
  };

  declare bind: string;
  declare format: string;

  private _node = new ContextConsumer(this, {context: nodeContext, subscribe: true});

  static styles = css`
    :host {
      display: inline;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      color: var(--color-text, #e0e0e0);
    }
  `;

  constructor() {
    super();
    this.bind = '';
    this.format = '';
  }

  private get _entryId(): string | undefined {
    const boxId = this._node.value?.boxId();
    if (!boxId) return undefined;
    const plugin = runtimeApi.getById(boxId);
    if (!plugin) return undefined;
    const el = findElementById(plugin.children, this.id) as ScDisplayNode | undefined;
    if (!el || el.type !== 'sc-display') return undefined;
    return el.runtime.value;
  }

  render() {
    const entryId = this._entryId;
    const value = entryId ? this._node.value?.getInputValue(entryId) : undefined;
    const text = this.format ? formatValue(this.format, value) : String(value ?? '');
    return html`${text}`;
  }
}
