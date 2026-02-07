declare module 'osc-js' {
  interface OscPlugin {
    open(options?: unknown): void;
    close(): void;
    send(binary: Uint8Array, options?: unknown): void;
    status(): number;
    registerNotify?(fn: (...args: unknown[]) => void): void;
  }

  interface OscOptions {
    plugin?: OscPlugin;
    discardLateMessages?: boolean;
  }

  class Message {
    constructor(address: string, ...args: Array<string | number | Uint8Array>);
    address: string;
    args: Array<string | number | Uint8Array>;
    add(value: string | number | Uint8Array): void;
    pack(): Uint8Array;
    unpack(data: DataView, offset?: number): number;
  }

  class Bundle {
    constructor(timetag?: { seconds: number; fractional: number }, ...messages: Message[]);
    pack(): Uint8Array;
  }

  class OSC {
    static Message: typeof Message;
    static Bundle: typeof Bundle;
    static STATUS: {
      IS_NOT_INITIALIZED: -1;
      IS_CONNECTING: 0;
      IS_OPEN: 1;
      IS_CLOSING: 2;
      IS_CLOSED: 3;
    };

    constructor(options?: OscOptions);
    on(address: string, handler: (...args: unknown[]) => void): void;
    off(address: string, handler: (...args: unknown[]) => void): void;
    open(options?: unknown): Promise<void>;
    close(): Promise<void>;
    send(packet: Message | Bundle, options?: unknown): void;
    status(): number;
  }

  export default OSC;
}
