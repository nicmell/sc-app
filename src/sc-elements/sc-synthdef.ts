import {LitElement, html} from 'lit';
import {ContextConsumer} from '@lit/context';
import {defRecvMessage} from '@/lib/osc/messages.ts';
import {oscService} from '@/lib/osc';
import {synthDefManager} from '@/lib/synthdef';
import {nodeContext} from './context.ts';

export class ScSynthDef extends LitElement {
  private _sent = false;

  constructor() {
    super();
    new ContextConsumer(this, {
      context: nodeContext,
      subscribe: true,
      callback: (ctx) => {
        if (ctx?.enabled && !this._sent) {
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
    this._sent = true;
  }

  render() {
    return html`<slot></slot>`;
  }
}
