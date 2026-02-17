import {ContextConsumer} from '@lit/context';
import {nodeContext} from './context.ts';
import {ScCheckbox} from './internal/sc-checkbox.ts';

export class ScRun extends ScCheckbox {
  static properties = {
    ...ScCheckbox.properties,
    run: {type: Boolean, reflect: true},
  };

  declare run: boolean;

  private _node = new ContextConsumer(this, {context: nodeContext, subscribe: true});

  constructor() {
    super();
    this.run = false;
  }

  updated(changed: Map<string, unknown>) {
    super.updated(changed);
    if (changed.has('run')) {
      this.checked = this.run;
    }
  }

  protected _onToggle(checked: boolean) {
    this.run = checked;
    this._node.value?.onRun(checked);
  }
}
