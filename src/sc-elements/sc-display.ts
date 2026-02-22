import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext, type NodeContext} from './context.ts';
import {StoreSubscriber} from './store-subscriber.ts';
import {get} from '@/lib/utils/get';

function resolveContextProp(ctx: NodeContext | undefined, prop: string): unknown {
  if (!ctx) return undefined;
  if (prop.startsWith('input.')) {
    const id = prop.slice(6);
    return ctx.inputs.find(e => e.id === id)?.value;
  }
  return get(ctx, prop);
}

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
    prop: {type: String},
    format: {type: String},
  };

  declare prop: string;
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
    this.prop = '';
    this.format = '';
    new StoreSubscriber(this, () => resolveContextProp(this._node.value, this.prop));
  }

  render() {
    const value = resolveContextProp(this._node.value, this.prop);
    const text = this.format ? formatValue(this.format, value) : String(value ?? '');
    return html`${text}`;
  }
}
