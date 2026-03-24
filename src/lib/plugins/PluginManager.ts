import type {PluginInfo} from "@/types/stores";
import type {ScElementNode, ScUgenNode, ScSynthDefNode, RuntimeValueEntry, ScPluginNode} from "@/types/parsers";
import {ELEMENTS} from "@/constants/sc-elements";
import {layoutApi, pluginsApi, runtimeApi} from "@/lib/stores/api";
import {get, post, del} from "@/lib/http";
import {processHtml} from "@/lib/html";
import {synthDefManager} from "@/lib/synthdef";

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

        const entries: Record<string, RuntimeValueEntry> = {};
        const synthdefs: ScSynthDefNode[] = [];
        const nodes: Record<string, ScElementNode> = {};

        processHtml<ScPluginNode>({
            rootId: boxId,
            tree: {id: boxId, type: ELEMENTS.SC_PLUGIN},
            element: doc.documentElement,
            saved: runtimeApi.getById(boxId) ?? undefined,
            entries,
            synthdefs,
            nodes,
            persistedEntries: runtimeApi.entries,
        });

        // Compile synthdefs — deferred until after processHtml so children (ugens) are populated
        for (const sd of synthdefs) {
            const ugenChildren = sd.children.filter((c): c is ScUgenNode => c.type === 'sc-ugen');
            if (ugenChildren.length > 0) {
                const specsMap = new Map(ugenChildren.map(c =>
                    [c.name, {name: c.name, type: c.ugen, rate: c.rate, inputs: c.controls}]
                ));
                synthDefManager.compile(boxId, sd.id, sd.name, sd.controls, specsMap);
            }
        }

        runtimeApi.loadPlugin({id: boxId, nodes, entries});
        return doc.documentElement.innerHTML;
    }
}

export const pluginManager = new PluginManager();
