import {ContextConsumer} from '@lit/context';
import {nodeContext, type ScElement} from './context.ts';
import {ScCheckbox} from './internal/sc-checkbox.ts';

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
  getInputs(): Record<string, any> {
    return this.param ? {[this.param]: this.checked ? 1 : 0} : {};
  }

  protected _onToggle() {
    this._notifyChange();
  }

  private _notifyChange() {
    this._node.value?.onChange(this);
  }
}
