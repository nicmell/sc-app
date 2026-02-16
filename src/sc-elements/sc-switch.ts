import {ContextConsumer} from '@lit/context';
import {synthContext, type ScElement} from './context.ts';
import {ScCheckbox} from './sc-checkbox.ts';

export class ScSwitch extends ScCheckbox implements ScElement {
  static properties = {
    ...ScCheckbox.properties,
    param: {type: String},
  };

  declare param: string;

  private _synth = new ContextConsumer(this, {context: synthContext, subscribe: true,
    callback: (ctx) => ctx?.register(this),
  });

  constructor() {
    super();
    this.param = '';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._synth.value?.unregister(this);
  }

  getParams(): Record<string, number> {
    return this.param ? {[this.param]: this.checked ? 1 : 0} : {};
  }

  protected _onToggle() {
    this._synth.value?.onChange(this);
  }
}
