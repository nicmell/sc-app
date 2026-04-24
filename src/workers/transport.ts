/**
 * Worker-internal WebSocket wrapper. Binary-only, no reconnection, no
 * framing — one WS binary frame in, one out. The protocol knowledge
 * (OSC) lives one layer up.
 */

export interface OscTransport {
  /** Send one binary frame. */
  send(bytes: Uint8Array): void;
  /** Register a receiver. Returns an unsubscribe. */
  onMessage(cb: (bytes: Uint8Array) => void): () => void;
  /** Register an error handler. Returns an unsubscribe. */
  onError(cb: (err: Event) => void): () => void;
  /** Register a close handler. Returns an unsubscribe. */
  onClose(cb: (ev: CloseEvent) => void): () => void;
  /** Await the `open` event. */
  readonly ready: Promise<void>;
  /** Close the socket and await its close event. */
  close(): Promise<void>;
}

export function createOscTransport(url: string): OscTransport {
  const ws = new WebSocket(url);
  ws.binaryType = 'arraybuffer';

  const msgCbs = new Set<(bytes: Uint8Array) => void>();
  const errCbs = new Set<(ev: Event) => void>();
  const closeCbs = new Set<(ev: CloseEvent) => void>();

  const ready = new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      ws.removeEventListener('open', onOpen);
      ws.removeEventListener('error', onErrorBeforeOpen);
      resolve();
    };
    const onErrorBeforeOpen = () => {
      ws.removeEventListener('open', onOpen);
      ws.removeEventListener('error', onErrorBeforeOpen);
      reject(new Error('websocket failed to open'));
    };
    ws.addEventListener('open', onOpen);
    ws.addEventListener('error', onErrorBeforeOpen);
  });

  ws.addEventListener('message', (ev) => {
    const data = ev.data;
    if (data instanceof ArrayBuffer) {
      const bytes = new Uint8Array(data);
      for (const cb of msgCbs) cb(bytes);
    }
    // Ignore text frames — the bridge only sends binary.
  });

  ws.addEventListener('error', (ev) => {
    for (const cb of errCbs) cb(ev);
  });

  ws.addEventListener('close', (ev) => {
    for (const cb of closeCbs) cb(ev);
  });

  return {
    send(bytes) {
      ws.send(bytes);
    },
    onMessage(cb) {
      msgCbs.add(cb);
      return () => msgCbs.delete(cb) as unknown as void;
    },
    onError(cb) {
      errCbs.add(cb);
      return () => errCbs.delete(cb) as unknown as void;
    },
    onClose(cb) {
      closeCbs.add(cb);
      return () => closeCbs.delete(cb) as unknown as void;
    },
    ready,
    close() {
      return new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) {
          resolve();
          return;
        }
        ws.addEventListener('close', () => resolve(), { once: true });
        ws.close();
      });
    },
  };
}
