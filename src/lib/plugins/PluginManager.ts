import type {PluginInfo} from "@/types/stores";
import type {ScElementNode, ScPluginNode, PluginTreeEntry, RuntimeValueEntry} from "@/types/parsers";
import {ELEMENTS} from "@/constants/sc-elements";
import {layoutApi, pluginsApi, runtimeApi} from "@/lib/stores/api";
import {get, post, del} from "@/lib/http";
import {processHtml} from "@/lib/html";

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

        // Phase 1: HTML parsing
        const saved = runtimeApi.getById(boxId);

        const entries = new Map<string, RuntimeValueEntry>();
        const nodesMap = new Map<string, ScElementNode>();

        const root = processHtml<ScPluginNode>({
            rootId: boxId,
            scope: [{id: boxId, type: ELEMENTS.SC_PLUGIN} as unknown as ScElementNode],
            elements: [doc.documentElement],
            saved: saved ? [saved] : [],
            nodesMap,
            entries,
            persistedEntries: runtimeApi.entries,
            offset: 0,
        });

        const entriesRecord: Record<string, RuntimeValueEntry> = {};
        for (const [id, entry] of entries) {
            entriesRecord[id] = entry;
        }

        return {
            title: doc.title,
            tree: root.children,
            entries: entriesRecord,
            runtime: root.runtime,
            html: doc.documentElement.innerHTML,
        };
    }
}

export const pluginManager = new PluginManager();
