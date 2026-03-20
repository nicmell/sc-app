import {LitElement, html} from 'lit';
import {defRecvMessage} from '@/lib/osc/messages.ts';
import {oscService} from '@/lib/osc';
import {synthDefManager} from '@/lib/synthdef';

export class ScSynthDef extends LitElement {
  private _sent = false;

  protected firstUpdated() {
    queueMicrotask(() => this._sendDef());
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
