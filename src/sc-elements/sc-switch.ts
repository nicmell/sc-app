import {ContextConsumer} from '@lit/context';
import {nodeContext, type ScElement} from './context.ts';
import {ScCheckbox} from './sc-checkbox.ts';

export class ScSwitch extends ScCheckbox implements ScElement {
  static properties = {
    ...ScCheckbox.properties,
    param: {type: String},
  };

  declare param: string;

  private _node = new ContextConsumer(this, {context: nodeContext, subscribe: true,
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
    return this.param ? {[this.param]: this.checked ? 1 : 0} : {};
  }

  protected _onToggle() {
    this._node.value?.onChange(this);
  }
}
