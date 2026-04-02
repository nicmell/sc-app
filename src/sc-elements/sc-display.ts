import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext} from './context.ts';
import {resolveInputRuntime} from './resolve.ts';
import {runtimeApi} from '@/lib/stores/api';
import {isControl} from '@/lib/utils/guards';

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
    new ContextConsumer(this, {context: nodeContext, subscribe: true});
    this.bind = '';
    this.format = '';
  }

  private get _runtime() {
    return resolveInputRuntime(this.id, 'sc-display');
  }

  render() {
    const rt = this._runtime;
    const control = rt ? runtimeApi.getById(rt.targetId) : undefined;
    const value = control && isControl(control) ? control.runtime.value : undefined;
    const text = this.format ? formatValue(this.format, value) : String(value ?? '');
    return html`${text}`;
  }
}
