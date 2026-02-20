import type {PluginInfo} from "@/types/stores";
import {pluginsApi} from "@/lib/stores/api";
import {rehydrate} from "@/lib/stores/store";
import {get, post, del} from "@/lib/http";

export const PLUGINS_URL = "app://plugins";

export class PluginManager {

  async listPlugins(): Promise<PluginInfo[]> {
    const resp = await get(PLUGINS_URL);
    return resp.json();
  }

  async addPlugin(file: File): Promise<void> {
    const buffer = await file.arrayBuffer();
    const resp = await post(PLUGINS_URL, new Uint8Array(buffer));
    const plugin: PluginInfo = await resp.json();
    pluginsApi.addPlugin(plugin);
    await rehydrate();
  }

  async removePlugin(plugin: PluginInfo): Promise<void> {
    await del(`${PLUGINS_URL}/${plugin.id}`);
    pluginsApi.removePlugin(plugin.id);
    await rehydrate();
  }

  async loadPlugin(pluginId: string, target: HTMLElement): Promise<void> {
    const plugin = pluginsApi.getById(pluginId);
    if (!plugin) return;
    try {
      const resp = await get(`${PLUGINS_URL}/${plugin.id}/${plugin.entry}`);
      target.innerHTML = await resp.text();
      pluginsApi.loadPlugin({id: plugin.id, loaded: true});
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      pluginsApi.loadPlugin({id: plugin.id, loaded: false, error});
    }
  }
}

export const pluginManager = new PluginManager();
