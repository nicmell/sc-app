import type {PersistStorage, StorageValue} from "zustand/middleware";

const FILE = "config.json";

let lastWritten = "";

export const tauriStorage: PersistStorage<any> = {
  async getItem() {
    try {
      const {readTextFile} = await import("@tauri-apps/plugin-fs");
      const {BaseDirectory} = await import("@tauri-apps/api/path");
      const text = await readTextFile(FILE, {baseDir: BaseDirectory.AppData});
      lastWritten = text;
      return {state: JSON.parse(text), version: 0};
    } catch {
      return null;
    }
  },

  async setItem(_name: string, {state}: StorageValue<unknown>) {
    const json = JSON.stringify(state, null, 2);
    if (json === lastWritten) return;
    lastWritten = json;
    const {writeTextFile} = await import("@tauri-apps/plugin-fs");
    const {BaseDirectory} = await import("@tauri-apps/api/path");
    await writeTextFile(FILE, json, {baseDir: BaseDirectory.AppData});
  },

  async removeItem() {
    try {
      lastWritten = "";
      const {remove} = await import("@tauri-apps/plugin-fs");
      const {BaseDirectory} = await import("@tauri-apps/api/path");
      await remove(FILE, {baseDir: BaseDirectory.AppData});
    } catch {
      // ignore
    }
  },
};
