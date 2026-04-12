import {html} from 'lit';
import type {ScSynthDefItem} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {isSynthDef} from '@/lib/utils/guards';
import {oscService} from '@/lib/osc';
import {synthDefManager} from '@/lib/synthdef';
import {runtimeApi} from '@/lib/stores/api';
import {ScElement} from './internal/sc-element.ts';

export class ScSynthDef extends ScElement<ScSynthDefItem, boolean> {

  getState(state: RuntimeState): boolean {
    const self = state.nodes[this.id];
    return self != null && isSynthDef(self) && self.runtime.loaded;
  }

  protected _sendCreate() {
    const bytes = synthDefManager.get(this.id);
    if (!bytes || bytes.length === 0) {
      console.warn(`<sc-synthdef id="${this.id}"> no compiled bytes found`);
      return;
    }
    oscService.sendSynthDef(new Uint8Array(bytes));
    super._sendCreate();
    runtimeApi.loadSynthdef({id: this.id});
  }

  render() {
    return html`<slot></slot>`;
  }
}
