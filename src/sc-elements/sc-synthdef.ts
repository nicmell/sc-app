import {LitElement, html} from 'lit';
import {ContextProvider} from '@lit/context';
import {synthdefContext, type SynthDefContext, type UGenElementSpec} from './context.ts';
import {buildSynthDefFromSpecs} from '@/lib/ugen/declarative';
import {defRecvMessage} from '@/lib/osc/messages.ts';
import {oscService} from '@/lib/osc';

const SKIP_ATTRS = new Set(['name', 'class', 'style', 'slot']);

export class ScSynthDef extends LitElement {
  private _specs = new Map<string, UGenElementSpec>();
  private _sent = false;

  constructor() {
    super();

    const ctx: SynthDefContext = {
      registerUGen: (spec) => this._specs.set(spec.name, spec),
      unregisterUGen: (name) => this._specs.delete(name),
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
    if (!this.getAttribute('name')) {
      console.error('<sc-synthdef> requires a name attribute');
      return;
    }
    const name = this.getAttribute('name')!;
    if (this._specs.size === 0) {
      console.warn(`<sc-synthdef name="${name}"> has no <sc-ugen> children`);
      return;
    }

    try {
      const params = this._collectParams();
      const def = buildSynthDefFromSpecs(name, params, this._specs);
      const bytes = def.toBytes();
      oscService.send(defRecvMessage(bytes));
      this._sent = true;
    } catch (err) {
      console.error(`<sc-synthdef name="${name}"> build failed:`, err);
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}
