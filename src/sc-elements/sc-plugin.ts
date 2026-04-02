import {html} from 'lit';
import {pluginManager} from '@/lib/plugins/PluginManager';
import {runtimeApi} from '@/lib/stores/api';
import {synthDefManager} from '@/lib/synthdef';
import {store} from '@/lib/stores/store';
import {isPlugin} from '@/lib/utils/guards';
import {ScGroup} from './sc-group.ts';

export class ScPlugin extends ScGroup {
  static properties = {
    ...ScGroup.properties,
    _loading: {state: true},
    _error: {state: true},
  };

  declare _loading: boolean;
  declare _error: string;
  private _unsubscribePlugin?: () => void;

  constructor() {
    super();
    this._loading = true;
    this._error = '';
  }

  // ScPlugin manages its own enabled lifecycle — ignore parent context
  protected _onParentEnabledChanged(): void {}

  protected async firstUpdated() {
    this._unsubscribePlugin = store.subscribe(() => {
      const node = runtimeApi.getById(this.id);
      if (!node || !isPlugin(node)) return;
      const error = node.runtime.error ?? '';
      if (error !== this._error) this._error = error;
    });
    try {
      this.innerHTML = await pluginManager.fetchPluginHtml(this.id);
      pluginManager.processPlugin(this.id, this);
      this._sendCreate();
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
    } finally {
      this._loading = false;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribePlugin?.();
    synthDefManager.clearBox(this.id);
    runtimeApi.unloadPlugin(this.id);
  }

  render() {
    return html`
      ${this._error ? html`<div style="color:#e57373;font-size:0.85rem;padding:0.5rem 0">${this._error}</div>` : ''}
      ${this._loading ? html`<div style="font-size:0.85rem;padding:0.5rem 0;opacity:0.6">Loading...</div>` : ''}
      <slot></slot>
    `;
  }
}
