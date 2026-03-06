import {html} from 'lit';
import {pluginManager} from '@/lib/plugins/PluginManager';
import {layoutApi} from '@/lib/stores/api';
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
      this.innerHTML = await pluginManager.loadPlugin(this.id);;
      this._loading = false;
      layoutApi.loadPlugin({id: this.id, loaded: true});
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this._loading = false;
      this._error = error;
      layoutApi.loadPlugin({id: this.id, loaded: false, error});
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    layoutApi.unloadPlugin(this.id);
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
