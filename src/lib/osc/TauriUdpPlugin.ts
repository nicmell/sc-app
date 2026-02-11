import OSC from 'osc-js';
import { TauriDatagramSocket } from './TauriDatagramSocket';

type NotifyFn = (...args: unknown[]) => void;

export interface TauriUdpPluginOptions {
  open?: { host?: string; port?: number };
  send?: { host?: string; port?: number };
}

const defaultOptions = {
  open: { host: '0.0.0.0', port: 0 },
  send: { host: '127.0.0.1', port: 57110 },
};

function merge(
  base: typeof defaultOptions,
  custom?: TauriUdpPluginOptions,
): typeof defaultOptions {
  return {
    open: { ...base.open, ...custom?.open },
    send: { ...base.send, ...custom?.send },
  };
}

export class TauriUdpPlugin extends OSC.Plugin {
  private options: typeof defaultOptions;
  private socket: TauriDatagramSocket;
  private socketStatus: number;
  private notify: NotifyFn;
  private pendingResolvers: Array<(data: Uint8Array) => void> = [];

  constructor(options?: TauriUdpPluginOptions) {
    super();
    this.options = merge(defaultOptions, options);
    this.socket = new TauriDatagramSocket();
    this.socketStatus = OSC.STATUS.IS_NOT_INITIALIZED;

    this.socket.on('message', (message: unknown) => {
      if (this.pendingResolvers.length > 0) {
        this.pendingResolvers.shift()!(message as Uint8Array);
      }
      this.notify(message);
    });

    this.socket.on('error', (error: unknown) => {
      this.notify('error', error);
    });

    this.notify = () => {};
  }

  registerNotify(fn: NotifyFn): void {
    this.notify = fn;
  }

  status(): number {
    return this.socketStatus;
  }

  open(customOptions?: { host?: string; port?: number }): void {
    if (customOptions) {
      this.options = { ...this.options, send: { ...this.options.send, ...customOptions } };
    }
    this.socketStatus = OSC.STATUS.IS_CONNECTING;

    this.socket.bind(
      { address: this.options.open.host, port: this.options.open.port },
      () => {
        this.socketStatus = OSC.STATUS.IS_OPEN;
        this.notify('open');
      },
    );
  }

  close(): void {
    this.socketStatus = OSC.STATUS.IS_CLOSING;

    this.socket.close(() => {
      this.socketStatus = OSC.STATUS.IS_CLOSED;
      this.notify('close');
    });
  }

  send(binary: Uint8Array, customOptions?: { host?: string; port?: number }): void {
    const options = { ...this.options.send, ...customOptions };
    this.socket.send(binary, 0, binary.byteLength, options.port, options.host);
  }
}
