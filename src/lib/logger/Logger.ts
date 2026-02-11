import {create, type StoreApi, type UseBoundStore} from "zustand";

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
    this.useStore.setState((state) => ({
      entries: [
        ...state.entries.slice(-(MAX_ENTRIES - 1)),
        `[${new Date().toLocaleTimeString()}] ${msg}`,
      ],
    }));
  }

  clear(): void {
    this.useStore.setState({entries: []});
  }
}
