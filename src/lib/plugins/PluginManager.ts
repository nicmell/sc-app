import type {PluginInfo} from "@/types/stores";
import {pluginsApi} from "@/lib/stores/api";
import {rehydrate} from "@/lib/stores/store";

export const PLUGINS_URL = "app://plugins";

export class PluginManager {

  async addPlugin(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    const resp = await fetch(PLUGINS_URL, {
      method: "POST",
      body: new Uint8Array(buffer),
    });
    if (!resp.ok) throw new Error(`Failed to add plugin: ${resp.statusText}`);
    const plugin: PluginInfo = await resp.json();
    pluginsApi.addPlugin(plugin);
    await rehydrate();
  }

  async removePlugin(plugin: PluginInfo): Promise<void> {
    const resp = await fetch(`${PLUGINS_URL}/${plugin.id}`, {method: "DELETE"});
    if (!resp.ok) throw new Error(`Failed to remove plugin: ${resp.statusText}`);
    pluginsApi.removePlugin(plugin.id);
    await rehydrate();
  }

  async loadPlugin(plugin: PluginInfo, target: HTMLElement): Promise<void> {
    try {
      const resp = await fetch(`${PLUGINS_URL}/${plugin.id}/${plugin.entry}`);
      if (!resp.ok) {
        pluginsApi.loadPlugin({
          id: plugin.id,
          loaded: false,
          error: {code: resp.status, message: resp.statusText},
        });
        return;
      }
      target.innerHTML = await resp.text();
      pluginsApi.loadPlugin({id: plugin.id, loaded: true});
    } catch (e) {
      pluginsApi.loadPlugin({
        id: plugin.id,
        loaded: false,
        error: {code: 0, message: e instanceof Error ? e.message : String(e)},
      });
    }
  }

}

export const pluginManager = new PluginManager();
