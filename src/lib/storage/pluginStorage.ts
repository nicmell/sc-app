import {invoke} from "@tauri-apps/api/core";
import type {PluginInfo} from "@/types/stores";

export async function installPlugin(file: File): Promise<PluginInfo> {
  const buffer = await file.arrayBuffer();
  return invoke<PluginInfo>("add_plugin", {data: Array.from(new Uint8Array(buffer))});
}

export async function removePlugin(name: string, version: string): Promise<void> {
  return invoke("remove_plugin", {name, version});
}

export function pluginUrl(name: string, version: string, filePath: string): string {
  return `plugins://${name}/${version}/${filePath}`;
}
