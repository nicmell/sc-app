import {LitElement} from 'lit';
import {ContextConsumer} from '@lit/context';
import {synthdefContext, type SynthDefContext, type UGenElementSpec} from './context.ts';

const SKIP_ATTRS = new Set(['id', 'type', 'rate', 'class', 'style', 'slot']);

export class ScUgen extends LitElement {
  static properties = {
    type: {type: String},
    rate: {type: String},
  };

  declare type: string;
  declare rate: string;

  private _parentCtx: ContextConsumer<{__context__: SynthDefContext}, this>;
  private _registered = false;

  constructor() {
    super();
    this.type = '';
    this.rate = 'ar';
    this._parentCtx = new ContextConsumer(this, {
      context: synthdefContext,
      subscribe: false,
      callback: () => this._tryRegister(),
    });
  }

  private _buildSpec(): UGenElementSpec {
    const inputs: Record<string, string> = {};
    for (const attr of this.attributes) {
      if (!SKIP_ATTRS.has(attr.name)) {
        inputs[attr.name] = attr.value;
      }
    }
    return {
      id: this.id,
      type: this.type,
      rate: this.rate,
      inputs,
    };
  }

  private _tryRegister() {
    const ctx = this._parentCtx.value;
    if (!ctx || !this.id || !this.type) return;
    ctx.registerUGen(this._buildSpec());
    this._registered = true;
  }

  protected firstUpdated() {
    this._tryRegister();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._registered && this._parentCtx.value) {
      this._parentCtx.value.unregisterUGen(this.id);
      this._registered = false;
    }
  }

  createRenderRoot() {
    return this;
  }
}
