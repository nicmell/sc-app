import {invoke} from "@tauri-apps/api/core";
import type {PluginInfo} from "@/types/stores";

export async function addPlugin(file: File): Promise<PluginInfo> {
  const buffer = await file.arrayBuffer();
  return invoke<PluginInfo>("add_plugin", {data: Array.from(new Uint8Array(buffer))});
}

export async function removePlugin(id: string): Promise<void> {
  await invoke("remove_plugin", {id});
}

export function pluginUrl(name: string, version: string, filePath: string): string {
  return `plugins://${name}/${version}/${filePath}`;
}
