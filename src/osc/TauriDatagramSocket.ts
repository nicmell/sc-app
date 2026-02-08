import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

type EventCallback = (...args: unknown[]) => void;

/**
 * A dgram.Socket-compatible wrapper backed by Tauri IPC + events.
 *
 * Implements the subset of dgram.Socket used by osc-js DatagramPlugin:
 *   on('message', cb), on('error', cb), bind(), close(), send()
 */
export class TauriDatagramSocket {
  private listeners: Record<string, EventCallback[]> = {};
  private unlisten: UnlistenFn | null = null;

  on(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  private emit(event: string, ...args: unknown[]): void {
    const cbs = this.listeners[event];
    if (cbs) {
      for (const cb of cbs) {
        cb(...args);
      }
    }
  }

  bind(
    options: { address?: string; port?: number },
    callback: () => void,
  ): void {
    const address = options.address ?? '0.0.0.0';
    const port = options.port ?? 0;

    invoke('udp_bind', { localAddr: `${address}:${port}` })
      .then(async () => {
        this.unlisten = await listen<number[]>('osc-data', (event) => {
          this.emit('message', new Uint8Array(event.payload));
        });
        callback();
      })
      .catch((err) => {
        this.emit('error', err);
      });
  }

  close(callback: () => void): void {
    if (this.unlisten) {
      this.unlisten();
      this.unlisten = null;
    }

    invoke('udp_close')
      .then(() => {
        callback();
      })
      .catch((err) => {
        this.emit('error', err);
      });
  }

  send(
    data: Uint8Array,
    _offset: number,
    _length: number,
    port: number,
    host: string,
  ): void {
    invoke('udp_send', {
      target: `${host}:${port}`,
      data: Array.from(data),
    }).catch((err) => {
      this.emit('error', err);
    });
  }
}
