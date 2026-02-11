import {
  readTextFile,
  writeTextFile,
  remove,
} from "@tauri-apps/plugin-fs";
import {BaseDirectory} from "@tauri-apps/api/path";
import type {PersistStorage, StorageValue} from "zustand/middleware";

const FILE = "settings.json";
const baseDir = BaseDirectory.AppData;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tauriStorage: PersistStorage<any> = {
  async getItem() {
    try {
      const text = await readTextFile(FILE, {baseDir});
      return {state: JSON.parse(text), version: 0};
    } catch {
      return null;
    }
  },

  async setItem(_name: string, {state}: StorageValue<unknown>) {
    await writeTextFile(FILE, JSON.stringify(state, null, 2), {baseDir});
  },

  async removeItem() {
    try {
      await remove(FILE, {baseDir});
    } catch {
      // ignore
    }
  },
};
