import type {PluginInfo} from "@/types/stores";
import {IS_TAURI} from "@/lib/env";

export async function addPlugin(file: File): Promise<PluginInfo> {
  const buffer = await file.arrayBuffer();

  if (IS_TAURI) {
    const {invoke} = await import("@tauri-apps/api/core");
    return invoke<PluginInfo>("add_plugin", {data: Array.from(new Uint8Array(buffer))});
  }

  const res = await fetch("/api/plugins", {
    method: "POST",
    body: new Uint8Array(buffer),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function removePlugin(id: string): Promise<void> {
  if (IS_TAURI) {
    const {invoke} = await import("@tauri-apps/api/core");
    await invoke("remove_plugin", {id});
    return;
  }

  const res = await fetch(`/api/plugins/${encodeURIComponent(id)}`, {method: "DELETE"});
  if (!res.ok) throw new Error(await res.text());
}

export function pluginUrl(name: string, version: string, filePath: string): string {
  if (IS_TAURI) {
    return `plugins://${name}/${version}/${filePath}`;
  }
  return `/plugins/${name}/${version}/${filePath}`;
}
