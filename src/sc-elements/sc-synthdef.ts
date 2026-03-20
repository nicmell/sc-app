import {LitElement, html} from 'lit';
import {defRecvMessage} from '@/lib/osc/messages.ts';
import {oscService} from '@/lib/osc';
import {runtimeApi} from '@/lib/stores/api';
import type {ScSynthDefNode} from '@/types/parsers';

function getCompiledSynthDef(name: string): Uint8Array | undefined {
  const values = runtimeApi.values;
  for (const plugin of runtimeApi.items) {
    const el = findSynthDefNode(plugin.children, name);
    if (el) {
      const entry = values[el.runtime.value];
      if (entry && entry.type === 'synthdef' && entry.value.length > 0) {
        return new Uint8Array(entry.value);
      }
    }
  }
  return undefined;
}

function findSynthDefNode(elements: import('@/types/parsers').ScElementNode[], name: string): ScSynthDefNode | undefined {
  for (const el of elements) {
    if (el.type === 'sc-synthdef' && el.name === name) return el;
    if ('children' in el && Array.isArray(el.children)) {
      const found = findSynthDefNode(el.children, name);
      if (found) return found;
    }
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
