import {ContextConsumer} from '@lit/context';
import type {AnyElement} from '@/types/stores';
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
  getElement(): AnyElement | undefined {
    return this.param ? {type: 'input', id: this.param, value: this.checked ? 1 : 0} : undefined;
  }

  protected _onToggle() {
    this._notifyChange();
  }

  private _notifyChange() {
    this._node.value?.onChange(this);
  }
}
