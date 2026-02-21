import {LitElement, html, css} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext, type ScUGenData} from './context.ts';

export class ScUGen extends LitElement implements ScUGenData {
  static properties = {
    type: {type: String},
    rate: {type: String},
  };

  declare type: string;
  declare rate: string;

  private _node = new ContextConsumer(this, {context: nodeContext, subscribe: false,
    callback: (ctx) => ctx?.registerUGen(this),
  });

  static styles = css`:host { display: contents; }`;

  constructor() {
    super();
    this.type = '';
    this.rate = 'ar';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._node.value?.unregisterUGen(this);
  }

  render() {
    return html`<slot></slot>`;
  }
}
