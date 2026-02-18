import type {PersistStorage, StorageValue} from "zustand/middleware";

const KEY = "config";

let lastWritten = "";

export const browserStorage: PersistStorage<any> = {
  async getItem() {
    try {
      const text = localStorage.getItem(KEY);
      if (!text) return null;
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
    localStorage.setItem(KEY, json);
  },

  async removeItem() {
    lastWritten = "";
    localStorage.removeItem(KEY);
  },
};
