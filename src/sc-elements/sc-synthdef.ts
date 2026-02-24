import {LitElement, html} from 'lit';
import {ContextProvider} from '@lit/context';
import {synthdefContext, type SynthDefContext, type UGenElementSpec} from './context.ts';
import {buildSynthDefFromSpecs} from '@/lib/ugen/declarative';
import {defRecvMessage} from '@/lib/osc/messages.ts';
import {oscService} from '@/lib/osc';

const SKIP_ATTRS = new Set(['id', 'class', 'style', 'slot']);

export class ScSynthDef extends LitElement {
  private _specs = new Map<string, UGenElementSpec>();
  private _sent = false;

  constructor() {
    super();

    const ctx: SynthDefContext = {
      registerUGen: (spec) => this._specs.set(spec.id, spec),
      unregisterUGen: (id) => this._specs.delete(id),
    };
    new ContextProvider(this, {context: synthdefContext, initialValue: ctx});
  }

  private _collectParams(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const attr of this.attributes) {
      if (SKIP_ATTRS.has(attr.name)) continue;
      const val = Number(attr.value);
      if (!isNaN(val)) {
        params[attr.name] = val;
      }
    }
    return params;
  }

  protected firstUpdated() {
    // Use microtask to ensure all children have registered
    queueMicrotask(() => this._buildAndSend());
  }

  private _buildAndSend() {
    if (this._sent) return;
    if (!this.id) {
      console.error('<sc-synthdef> requires an id attribute');
      return;
    }
    if (this._specs.size === 0) {
      console.warn(`<sc-synthdef id="${this.id}"> has no <sc-ugen> children`);
      return;
    }

    try {
      const params = this._collectParams();
      const def = buildSynthDefFromSpecs(this.id, params, this._specs);
      const bytes = def.toBytes();
      oscService.send(defRecvMessage(bytes));
      this._sent = true;
    } catch (err) {
      console.error(`<sc-synthdef id="${this.id}"> build failed:`, err);
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
