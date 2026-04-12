import {IS_TAURI} from '@/lib/env';

type DataHandler = (data: ArrayLike<number>) => void;

interface BindConfig {
  /** Tauri: invoke command name to start streaming. */
  tauriCommand: string;
  /** Tauri: invoke command name to stop streaming. */
  tauriUnbindCommand: string;
  /** Tauri: event name emitted by Rust with payload data. */
  tauriEvent: string;
  /** Tauri: args passed to the bind invoke (merged with the channel's args). */
  tauriArgs?: Record<string, unknown>;
  /** Browser: WebSocket URL path (e.g. '/scope'). */
  wsPath: string;
  /** Browser: binary request payload to send on each read cycle. */
  wsRequest?: () => ArrayBuffer;
}

/**
 * Generic binary data channel between the frontend and the Rust backend.
 * Abstracts two transports behind a single bind/unbind interface:
 *
 *   - **Tauri**: invoke(bindCommand) starts a Rust loop that pushes data
 *     via window.emit(event). Same pattern as udp_bind / osc-data.
 *   - **Browser**: WebSocket with binary request/response. If wsRequest
 *     is provided, the channel sends it and awaits a response in a loop.
 *     Otherwise it listens for server-pushed messages.
 */
export class BinaryChannel {
  private config: BindConfig;
  private handler: DataHandler | null = null;
  private bound = false;

  // Tauri
  private unlisten: (() => void) | null = null;

  // Browser
  private ws: WebSocket | null = null;
  private wsResolve: ((buf: ArrayBuffer) => void) | null = null;
  private readActive = false;

  constructor(config: BindConfig) {
    this.config = config;
  }

  onData(fn: DataHandler): void {
    this.handler = fn;
  }

  async bind(args?: Record<string, unknown>): Promise<void> {
    if (this.bound) return;
    this.bound = true;

    if (IS_TAURI) {
      await this.tauriBind(args);
    } else {
      this.wsBind(args);
    }
  }

  async unbind(): Promise<void> {
    if (!this.bound) return;
    this.bound = false;

    if (IS_TAURI) {
      await this.tauriUnbind();
    } else {
      this.wsUnbind();
    }
  }

  // --- Tauri: invoke + listen ---

  private async tauriBind(args?: Record<string, unknown>) {
    const {invoke} = await import('@tauri-apps/api/core');
    const {listen} = await import('@tauri-apps/api/event');

    this.unlisten = await listen<number[]>(this.config.tauriEvent, (event) => {
      this.handler?.(event.payload);
    });

    await invoke(this.config.tauriCommand, {...this.config.tauriArgs, ...args});
  }

  private async tauriUnbind() {
    if (this.unlisten) {
      this.unlisten();
      this.unlisten = null;
    }
    try {
      const {invoke} = await import('@tauri-apps/api/core');
      await invoke(this.config.tauriUnbindCommand);
    } catch { /* ignore during teardown */ }
  }

  // --- Browser: WebSocket binary ---

  private wsBind(_args?: Record<string, unknown>) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}${this.config.wsPath}`);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev: MessageEvent) => {
      if (ev.data instanceof ArrayBuffer) {
        if (this.wsResolve) {
          const resolve = this.wsResolve;
          this.wsResolve = null;
          resolve(ev.data);
        } else {
          // Server-pushed (no pending request)
          if (ev.data.byteLength > 0) {
            this.handler?.(new Float32Array(ev.data));
          }
        }
      }
    };
    ws.onclose = () => {
      this.ws = null;
      this.wsResolve = null;
    };
    this.ws = ws;

    if (this.config.wsRequest) {
      this.readActive = true;
      this.wsReadLoop();
    }
  }

  private wsUnbind() {
    this.readActive = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.wsResolve = null;
    }
  }

  private async wsReadLoop() {
    while (this.readActive && this.bound) {
      try {
        const n = await this.wsReadOnce();
        if (n === 0) {
          await new Promise(r => setTimeout(r, 50));
        }
      } catch {
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  private async wsReadOnce(): Promise<number> {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || !this.config.wsRequest) return 0;

    const req = this.config.wsRequest();

    const response = await new Promise<ArrayBuffer | null>((resolve) => {
      const timeout = setTimeout(() => { this.wsResolve = null; resolve(null) }, 3000);
      this.wsResolve = (buf) => { clearTimeout(timeout); resolve(buf) };
      ws.send(req);
    });

    if (!response || response.byteLength === 0) return 0;

    const floats = new Float32Array(response);
    this.handler?.(floats);
    return floats.length;
  }
}
