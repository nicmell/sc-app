import {html} from 'lit';
import {pluginManager} from '@/lib/plugins/PluginManager';
import {runtimeApi} from '@/lib/stores/api';
import {ScGroup} from './sc-group.ts';

export class ScPlugin extends ScGroup {
  static properties = {
    ...ScGroup.properties,
    _loading: {state: true},
    _error: {state: true},
  };

  declare _loading: boolean;
  declare _error: string;

  constructor() {
    super();
    this._loading = true;
    this._error = '';
  }

  protected async firstUpdated() {
    super.firstUpdated();
    try {
      const result = await pluginManager.loadPlugin(this.id);
      this.innerHTML = result.html;
      this._loading = false;
      runtimeApi.loadPlugin({id: this.id, loaded: true, title: result.title, elements: result.elements, entries: result.entries});
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this._loading = false;
      this._error = error;
      runtimeApi.loadPlugin({id: this.id, loaded: false, error});
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    runtimeApi.unloadPlugin(this.id);
  }

  render() {
    if (this._error) {
      return html`<div style="color:#e57373;font-size:0.85rem;padding:0.5rem 0">${this._error}</div>`;
    }
    if (this._loading) {
      return html`<div style="font-size:0.85rem;padding:0.5rem 0;opacity:0.6">Loading...</div>`;
    }
    return html`<slot></slot>`;
  }
}
