import {LitElement, html} from 'lit';
import {defRecvMessage} from '@/lib/osc/messages.ts';
import {oscService} from '@/lib/osc';
import {layoutApi} from '@/lib/stores/api';
import {isGroup, type ScElementNode} from '@/lib/parsers';

function findSynthDefBytes(elements: ScElementNode[], name: string): number[] | undefined {
  for (const el of elements) {
    if (el.type === 'sc-synthdef' && el.name === name) return el.runtime.value;
    if (isGroup(el)) {
      const found = findSynthDefBytes(el.children, name);
      if (found) return found;
    }
  }
  return undefined;
}

function getCompiledSynthDef(name: string): Uint8Array | undefined {
  for (const box of layoutApi.items) {
    if (!box.elements) continue;
    const bytes = findSynthDefBytes(box.elements, name);
    if (bytes) return new Uint8Array(bytes);
  }
  return undefined;
}

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

    const bytes = getCompiledSynthDef(name);
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
