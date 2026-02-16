import {ContextConsumer} from '@lit/context';
import {synthContext} from './context.ts';
import {ScCheckbox} from './sc-checkbox.ts';

export class ScToggle extends ScCheckbox {
  private _synth = new ContextConsumer(this, {context: synthContext, subscribe: true});

  protected _onToggle(checked: boolean) {
    this._synth.value?.onRun(checked);
  }
}
