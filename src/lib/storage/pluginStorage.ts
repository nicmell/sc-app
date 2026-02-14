import {invoke} from "@tauri-apps/api/core";
import type {PluginInfo} from "@/types/stores";

export async function installPlugin(file: File): Promise<PluginInfo> {
  const buffer = await file.arrayBuffer();
  return invoke<PluginInfo>("install", {data: Array.from(new Uint8Array(buffer))});
}

export async function removePlugin(name: string, version: string): Promise<void> {
  return invoke("remove", {name, version});
}

export function pluginUrl(name: string, version: string, filePath: string): string {
  return `plugins://${name}/${version}/${filePath}`;
}
