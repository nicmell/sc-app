import {html} from 'lit';
import {pluginManager} from '@/lib/plugins/PluginManager';
import {runtimeApi} from '@/lib/stores/api';
import {synthDefManager} from '@/lib/synthdef';
import type {ScPluginNode, PluginRuntime} from '@/types/parsers';
import {ScGroup} from './sc-group.ts';

export class ScPlugin extends ScGroup<ScPluginNode> {
  static properties = {
    ...ScGroup.properties,
    _error: {state: true},
  };

  declare _error: string;

  constructor() {
    super();
    this._error = '';
  }

  protected async firstUpdated() {
    try {
      this.innerHTML = await pluginManager.fetchPluginHtml(this.id);
      pluginManager.processPlugin(this.id, this);
      this._sendCreate();
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
    }
  }

  private get _pluginError(): string {
    return (this._state?.runtime as PluginRuntime | undefined)?.error ?? '';
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    synthDefManager.clearBox(this.id);
    runtimeApi.unloadPlugin(this.id);
  }

  render() {
    const error = this._error || this._pluginError;
    const loading = !this._state?.runtime.loaded && !error;
    return html`
      ${error ? html`<div style="color:#e57373;font-size:0.85rem;padding:0.5rem 0">${error}</div>` : ''}
      ${loading ? html`<div style="font-size:0.85rem;padding:0.5rem 0;opacity:0.6">Loading...</div>` : ''}
      <slot></slot>
    `;
  }
}
