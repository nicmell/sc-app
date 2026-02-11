import {
  readTextFile,
  writeTextFile,
  mkdir,
  remove,
  exists,
} from "@tauri-apps/plugin-fs";
import {BaseDirectory} from "@tauri-apps/api/path";
import type {StateStorage} from "zustand/middleware";

const DIR = "settings";
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

export const tauriStorage: StateStorage = {
  async getItem(name: string): Promise<string | null> {
    try {
      return await readTextFile(`${DIR}/${name}.json`, {baseDir});
    } catch {
      return null;
    }
  },

  async setItem(name: string, value: string): Promise<void> {
    await ensureDir();
    await writeTextFile(`${DIR}/${name}.json`, value, {baseDir});
  },

  async removeItem(name: string): Promise<void> {
    try {
      await remove(`${DIR}/${name}.json`, {baseDir});
    } catch {
      // ignore
    }
  },
};
