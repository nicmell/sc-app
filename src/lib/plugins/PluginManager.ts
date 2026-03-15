import type {PluginInfo} from "@/types/stores";
import {layoutApi, pluginsApi, runtimeApi} from "@/lib/stores/api";
import {rehydrate} from "@/lib/stores/store";
import {get, post, del} from "@/lib/http";
import {PluginParser, isGroup, isPlugin, type PluginTreeEntry, type ScElementNode} from "@/lib/parsers";

export const PLUGINS_URL = "app://plugins";

function findSynthDefBytes(elements: ScElementNode[], name: string): number[] | undefined {
  for (const el of elements) {
    if (el.type === 'sc-synthdef' && el.name === name) return el.bytes;
    if (isGroup(el)) {
      const found = findSynthDefBytes(el.children, name);
      if (found) return found;
    }
    if (isPlugin(el)) {
      const found = findSynthDefBytes(el.children, name);
      if (found) return found;
    }
  }
  return undefined;
}

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

  getCompiledSynthDef(name: string): Uint8Array | undefined {
    for (const plugin of runtimeApi.elements) {
      const bytes = findSynthDefBytes(plugin.children, name);
      if (bytes) return new Uint8Array(bytes);
    }
    return undefined;
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
    return this.treeParser.parse(doc.documentElement, boxId);
  }
}

export const pluginManager = new PluginManager();
