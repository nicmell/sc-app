import {ContextConsumer} from '@lit/context';
import {nodeContext} from './context.ts';
import {ScCheckbox} from './sc-checkbox.ts';

export class ScToggle extends ScCheckbox {
  private _node = new ContextConsumer(this, {context: nodeContext, subscribe: true});

  protected _onToggle(checked: boolean) {
    this._node.value?.onRun(checked);
  }
}
