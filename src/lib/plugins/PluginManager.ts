import type {PluginInfo} from "@/types/stores";
import type {ScElementItem, ScSynthDefItem} from "@/types/parsers";
import {ELEMENTS} from "@/constants/sc-elements";
import {layoutApi, pluginsApi, runtimeApi} from "@/lib/stores/api";
import {get, post, del} from "@/lib/http";
import {processHtml} from "@/lib/html";
import {hydrate} from "@/lib/html/processHtml.ts";

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
    }

    async removePlugin(plugin: PluginInfo): Promise<void> {
        await del(`${PLUGINS_URL}/${plugin.id}`);
        pluginsApi.removePlugin(plugin.id);
    }

    async loadPlugin(boxId: string, rootElement: Element): Promise<Map<string, ScElementItem>> {
        const box = layoutApi.getById(boxId);
        if (!box?.plugin) {
            throw new Error(`No plugin assigned for ${boxId}`);
        }
        const plugin = pluginsApi.getById(box.plugin);
        if (!plugin) {
            throw new Error(`Plugin ${box.plugin} not found`);
        }

        const resp = await get(`${PLUGINS_URL}/${plugin.id}/${plugin.entry}`);
        const text = await resp.text();
        const doc = new DOMParser().parseFromString(text, "text/xml");

        rootElement.innerHTML = doc.documentElement.innerHTML;

        const synthdefs: ScSynthDefItem[] = [];
        const nodes = new Map<string, ScElementItem>();
        const overrides = runtimeApi.overrides.filter(e => e.rootId === boxId);

        const tree = hydrate({id: boxId, type: ELEMENTS.SC_PLUGIN}, rootElement);
        processHtml({rootId: boxId, tree, scope: [tree], synthdefs, nodes, overrides, path: []});

        return nodes;
    }
}

export const pluginManager = new PluginManager();
