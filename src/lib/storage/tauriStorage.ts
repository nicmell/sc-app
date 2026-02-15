import {
  readTextFile,
  writeTextFile,
  remove,
} from "@tauri-apps/plugin-fs";
import {BaseDirectory} from "@tauri-apps/api/path";
import type {PersistStorage, StorageValue} from "zustand/middleware";

const FILE = "config.json";
const baseDir = BaseDirectory.AppData;

let lastWritten = "";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const tauriStorage: PersistStorage<any> = {
  async getItem() {
    try {
      const text = await readTextFile(FILE, {baseDir});
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
    await writeTextFile(FILE, json, {baseDir});
  },

  async removeItem() {
    try {
      lastWritten = "";
      await remove(FILE, {baseDir});
    } catch {
      // ignore
    }
  },
};
