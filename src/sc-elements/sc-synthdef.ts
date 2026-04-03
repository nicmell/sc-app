import {html} from 'lit';
import {ContextConsumer} from '@lit/context';
import type {ScSynthDefNode} from '@/types/parsers';
import type {RuntimeState} from '@/types/stores';
import {defRecvMessage} from '@/lib/osc/messages.ts';
import {oscService} from '@/lib/osc';
import {synthDefManager} from '@/lib/synthdef';
import {runtimeApi} from '@/lib/stores/api';
import {nodeContext} from './context.ts';
import {ScElement} from './internal/sc-element.ts';

export class ScSynthDef extends ScElement<ScSynthDefNode> {
  private _sent = false;

  getState(_state: RuntimeState): boolean {
    return this._runtime.loaded;
  }

  constructor() {
    super();
    new ContextConsumer(this, {
      context: nodeContext,
      subscribe: true,
      callback: (ctx) => {
        if (ctx?.loaded && !this._sent) {
          queueMicrotask(() => this._sendDef());
        }
      },
    });
  }

  private _sendDef() {
    if (this._sent) return;
    const bytes = synthDefManager.get(this.id);
    if (!bytes || bytes.length === 0) {
      console.warn(`<sc-synthdef id="${this.id}"> no compiled bytes found`);
      return;
    }

    oscService.send(defRecvMessage(new Uint8Array(bytes)));
    runtimeApi.loadSynthdef({id: this.id});
    this._sent = true;
  }

  render() {
    return html`<slot></slot>`;
  }
}
