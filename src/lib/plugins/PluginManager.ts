import type {PluginInfo} from "@/types/stores";
import {layoutApi, pluginsApi, runtimeApi} from "@/lib/stores/api";
import {rehydrate} from "@/lib/stores/store";
import {get, post, del} from "@/lib/http";
import {PluginParser, type PluginTreeEntry} from "@/lib/parsers";

export const PLUGINS_URL = "app://plugins";

export class PluginManager {
  private readonly treeParser = new PluginParser();

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

  async loadPlugin(boxId: string): Promise<PluginTreeEntry> {
    const box = layoutApi.getById(boxId);
    if (!box?.plugin) {
      throw new Error(`No plugin assigned for ${boxId}`);
    }
    const plugin = pluginsApi.getById(box.plugin);
    if (!plugin) throw new Error(`Plugin ${box.plugin} not found`);
    const resp = await get(`${PLUGINS_URL}/${plugin.id}/${plugin.entry}`);
    const text = await resp.text();
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const error = doc.querySelector("parsererror");
    if (error) {
      throw new Error(error.textContent ?? "Invalid XHTML")
    }
    const saved = runtimeApi.getById(boxId);
    return this.treeParser.parse(doc.documentElement, saved?.children);
  }
}

export const pluginManager = new PluginManager();
