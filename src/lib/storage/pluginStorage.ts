import {invoke} from "@tauri-apps/api/core";
import type {PluginInfo} from "@/types/stores";

export async function installPlugin(file: File): Promise<PluginInfo> {
  const buffer = await file.arrayBuffer();
  return invoke<PluginInfo>("install", {data: Array.from(new Uint8Array(buffer))});
}

export async function removePlugin(name: string): Promise<void> {
  return invoke("remove", {name});
}

export function pluginUrl(pluginName: string, filePath: string): string {
  return `plugins://${encodeURIComponent(pluginName)}/${filePath}`;
}
