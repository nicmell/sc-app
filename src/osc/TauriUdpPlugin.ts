import { invoke } from '@tauri-apps/api/core';

const STATUS = {
  IS_NOT_INITIALIZED: -1,
  IS_CONNECTING: 0,
  IS_OPEN: 1,
  IS_CLOSING: 2,
  IS_CLOSED: 3,
} as const;

type NotifyFn = (...args: unknown[]) => void;

export interface TauriUdpPluginOptions {
  targetAddress?: string;
}

export class TauriUdpPlugin {
  private targetAddress: string;
  private socketStatus: number;
  private notify: NotifyFn;

  constructor(options?: TauriUdpPluginOptions) {
    this.targetAddress = options?.targetAddress ?? '127.0.0.1:57110';
    this.socketStatus = STATUS.IS_NOT_INITIALIZED;
    this.notify = () => {};
  }

  registerNotify(fn: NotifyFn): void {
    this.notify = fn;
  }

  status(): number {
    return this.socketStatus;
  }

  async open(customOptions?: TauriUdpPluginOptions): Promise<void> {
    this.socketStatus = STATUS.IS_CONNECTING;

    if (customOptions?.targetAddress) {
      this.targetAddress = customOptions.targetAddress;
    }

    try {
      await invoke('udp_bind', { localAddr: '0.0.0.0:0' });
      this.socketStatus = STATUS.IS_OPEN;
      this.notify('open');
    } catch (error) {
      this.socketStatus = STATUS.IS_CLOSED;
      this.notify('error', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.socketStatus !== STATUS.IS_OPEN) return;

    this.socketStatus = STATUS.IS_CLOSING;
    try {
      await invoke('udp_close');
      this.socketStatus = STATUS.IS_CLOSED;
      this.notify('close');
    } catch (error) {
      this.notify('error', error);
      throw error;
    }
  }

  async send(binary: Uint8Array, customOptions?: { targetAddress?: string }): Promise<void> {
    const target = customOptions?.targetAddress ?? this.targetAddress;
    const data: number[] = Array.from(binary);

    try {
      await invoke('udp_send', { target, data });
    } catch (error) {
      this.notify('error', error);
      throw error;
    }
  }
}
