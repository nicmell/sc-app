import type {PluginInfo} from "@/types/stores";
import {layoutApi, pluginsApi} from "@/lib/stores/api";
import {rehydrate} from "@/lib/stores/store";
import {get, post, del} from "@/lib/http";
import {ELEMENTS} from "@/constants/sc-elements";

export const PLUGINS_URL = "app://plugins";


type ScElementNode = {
  id: string;
  tagName: string;
  attributes: Record<string, string>;
  descendants: ScElementNode[];
}

const tagNames = new Set<string>(Object.values(ELEMENTS));
const STORAGE_KEY = 'sc-plugin-trees';

function loadSavedTree(boxId: string): ScElementNode[] | undefined {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${boxId}`);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function saveSavedTree(boxId: string, tree: ScElementNode[]): void {
  localStorage.setItem(`${STORAGE_KEY}:${boxId}`, JSON.stringify(tree));
}

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

  async loadPlugin(boxId: string): Promise<string> {
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
    const tree = buildScElementTree(doc.documentElement, loadSavedTree(boxId));
    saveSavedTree(boxId, tree);
    console.log("ScElementNode tree:", tree);

    return doc.documentElement.innerHTML;
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

function buildScElementTree(node: Element, saved?: ScElementNode[], offset = 0): ScElementNode[] {
  const result: ScElementNode[] = [];
  for (const child of Array.from(node.children)) {
    const tag = child.tagName.toLowerCase();
    if (!tagNames.has(tag)) {
      result.push(...buildScElementTree(child, saved, offset + result.length));
      continue;
    }
    const idx = offset + result.length;
    const prev = saved?.[idx];
    const rehydrated = prev?.tagName === tag;
    if (prev && !rehydrated) {
      console.warn(`[plugin hydration] mismatch at index ${idx}: <${tag}> vs saved <${prev.tagName}>`);
    }

    const id = rehydrated ? prev.id : generateId();
    child.setAttribute('id', id);

    const attributes: Record<string, string> = {};
    for (const attr of Array.from(child.attributes)) {
      attributes[attr.name] = attr.value;
    }
    const descendants = buildScElementTree(child, rehydrated ? prev.descendants : undefined);
    result.push({ id, tagName: tag, attributes, descendants });
  }
  if (offset === 0 && saved && result.length < saved.length) {
    console.warn(`[plugin hydration] ${saved.length - result.length} saved node(s) no longer present`);
  }
  return result;
}

export const pluginManager = new PluginManager();
