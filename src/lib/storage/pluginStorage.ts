import {
  writeFile,
  remove,
  mkdir,
  exists,
} from "@tauri-apps/plugin-fs";
import {BaseDirectory} from "@tauri-apps/api/path";

const DIR = "plugins";
const baseDir = BaseDirectory.AppData;

let dirCreated = false;

async function ensureDir() {
  if (dirCreated) return;
  const dirExists = await exists(DIR, {baseDir});
  if (!dirExists) {
    await mkdir(DIR, {baseDir, recursive: true});
  }
  dirCreated = true;
}

export async function savePluginFile(file: File): Promise<string> {
  await ensureDir();
  const buffer = await file.arrayBuffer();
  const path = `${DIR}/${file.name}`;
  await writeFile(path, new Uint8Array(buffer), {baseDir});
  return file.name;
}

export async function removePluginFile(name: string): Promise<void> {
  const path = `${DIR}/${name}`;
  try {
    await remove(path, {baseDir});
  } catch {
    // file may already be gone
  }
}

export function pluginUrl(name: string): string {
  return `plugins://${encodeURIComponent(name)}`;
}
