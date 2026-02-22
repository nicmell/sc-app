import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import type {AnyElement} from '@/types/stores';
import {nodeContext, type ScElement, type ScUGenData} from './context.ts';
import {UGEN_REGISTRY} from './internal/ugen-registry.ts';

export class ScUGen extends LitElement implements ScUGenData, ScElement {
  static properties = {
    type: {type: String},
    rate: {type: String},
  };

  declare type: string;
  declare rate: string;

  private _node = new ContextConsumer(this, {context: nodeContext, subscribe: false,
    callback: (ctx) => ctx?.registerElement(this),
  });

  static styles = css`:host { display: contents; }`;

  constructor() {
    super();
    this.type = '';
    this.rate = 'ar';
  }

  getElement(): AnyElement | undefined {
    const entry = UGEN_REGISTRY[this.type];
    const inputs: Record<string, any> = {};
    if (entry) {
      for (const paramName of entry.inputs) {
        const val = this.getAttribute(paramName);
        if (val != null) inputs[paramName] = val;
      }
    }
    return {type: 'ugen', id: this.id, ugen: this.type, rate: this.rate, inputs};
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._node.value?.unregisterElement(this);
  }

  render() {
    return html`<slot></slot>`;
  }
}
