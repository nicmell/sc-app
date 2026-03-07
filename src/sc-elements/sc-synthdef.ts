import {LitElement, html} from 'lit';
import {defRecvMessage} from '@/lib/osc/messages.ts';
import {oscService} from '@/lib/osc';
import {pluginManager} from '@/lib/plugins/PluginManager';

export class ScSynthDef extends LitElement {
  private _sent = false;

  protected firstUpdated() {
    queueMicrotask(() => this._sendDef());
  }

  private _sendDef() {
    if (this._sent) return;
    const name = this.getAttribute('name');
    if (!name) {
      console.error('<sc-synthdef> requires a name attribute');
      return;
    }

    const bytes = pluginManager.getCompiledSynthDef(name);
    if (!bytes) {
      console.warn(`<sc-synthdef name="${name}"> no compiled bytes found`);
      return;
    }

    oscService.send(defRecvMessage(bytes));
    this._sent = true;
  }

  render() {
    return html`<slot></slot>`;
  }
}
