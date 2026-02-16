import {create, type StoreApi, type UseBoundStore} from "zustand";
import {appendLogLine} from "@/lib/storage/logWriter";
import {_DEV_} from "@/constants/env";

interface LogState {
  entries: string[];
}

const MAX_ENTRIES = 50;

export class Logger {
  readonly useStore: UseBoundStore<StoreApi<LogState>>;

  constructor() {
    this.useStore = create<LogState>(() => ({entries: []}));
  }

  log(msg: string): void {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.useStore.setState((state) => ({
      entries: [...state.entries.slice(-(MAX_ENTRIES - 1)), line],
    }));
    appendLogLine(line);
    if (_DEV_) {
      console.log(line);
    }
  }

  clear(): void {
    this.useStore.setState({entries: []});
  }
}
