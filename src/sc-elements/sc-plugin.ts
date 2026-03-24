import {html} from 'lit';
import {pluginManager} from '@/lib/plugins/PluginManager';
import {runtimeApi} from '@/lib/stores/api';
import {synthDefManager} from '@/lib/synthdef';
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
      const plugin = result.nodes[this.id];
      if (plugin && 'runtime' in plugin && 'loaded' in plugin.runtime) {
        (plugin.runtime as {loaded: boolean}).loaded = true;
      }
      runtimeApi.loadPlugin({id: this.id, nodes: result.nodes, entries: result.entries});
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      this._loading = false;
      this._error = error;
      runtimeApi.loadPlugin({id: this.id, nodes: {
        [this.id]: {type: 'sc-plugin' as const, id: this.id, children: [], runtime: {rootId: this.id, run: '', controls: {}, loaded: false, error}},
      }});
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    synthDefManager.clearBox(this.id);
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
