import {LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import {nodeContext, type ScElement} from '../context.ts';

export class ScControl extends LitElement implements ScElement {
  static properties = {
    param: {type: String},
  };

  declare param: string;

  protected _node = new ContextConsumer(this, {context: nodeContext, subscribe: true,
    callback: (ctx) => ctx?.registerElement(this),
  });

  constructor() {
    super();
    this.param = '';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._node.value?.unregisterElement(this);
  }

  getParams(): Record<string, number> {
    return {};
  }

  protected _notifyChange() {
    this._node.value?.onChange(this);
  }
}
