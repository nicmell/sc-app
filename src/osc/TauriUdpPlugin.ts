import { invoke } from '@tauri-apps/api/core';
import OSC from 'osc-js';

type NotifyFn = (...args: unknown[]) => void;

export interface TauriUdpPluginOptions {
  targetAddress?: string;
}

export class TauriUdpPlugin extends OSC.Plugin {
  private targetAddress: string;
  private socketStatus: number;
  private notify: NotifyFn;

  constructor(options?: TauriUdpPluginOptions) {
    super();
    this.targetAddress = options?.targetAddress ?? '127.0.0.1:57110';
    this.socketStatus = OSC.STATUS.IS_NOT_INITIALIZED;
    this.notify = () => {};
  }

  registerNotify(fn: NotifyFn): void {
    this.notify = fn;
  }

  status(): number {
    return this.socketStatus;
  }

  async open(customOptions?: TauriUdpPluginOptions): Promise<void> {
    this.socketStatus = OSC.STATUS.IS_CONNECTING;

    if (customOptions?.targetAddress) {
      this.targetAddress = customOptions.targetAddress;
    }

    try {
      await invoke('udp_bind', { localAddr: '0.0.0.0:0' });
      this.socketStatus = OSC.STATUS.IS_OPEN;
      this.notify('open');
    } catch (error) {
      this.socketStatus = OSC.STATUS.IS_CLOSED;
      this.notify('error', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.socketStatus !== OSC.STATUS.IS_OPEN) return;

    this.socketStatus = OSC.STATUS.IS_CLOSING;
    try {
      await invoke('udp_close');
      this.socketStatus = OSC.STATUS.IS_CLOSED;
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

  async recv(timeoutMs: number): Promise<Uint8Array> {
    const data = await invoke<number[]>('udp_recv', { timeoutMs });
    return new Uint8Array(data);
  }
}
