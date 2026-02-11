import OSC from 'osc-js';
import {TauriUdpPlugin} from './TauriUdpPlugin';

function parseAddress(addr: string): { host: string; port: number } {
  const [host, portStr] = addr.split(':');
  return { host, port: parseInt(portStr, 10) };
}

export class OscService {
  private osc: InstanceType<typeof OSC>;

  constructor() {
    this.osc = new OSC({ plugin: new TauriUdpPlugin() });
  }

  get status(): number {
    return this.osc.status();
  }

  async open(address: string): Promise<void> {
    await this.osc.open(parseAddress(address));
  }

  async close(): Promise<void> {
    await this.osc.close();
  }

  send(msg: InstanceType<typeof OSC.Message>): void {
    this.osc.send(msg);
  }

  on(event: string, handler: (...args: unknown[]) => void): number {
    return this.osc.on(event, handler);
  }

  off(event: string, subscriptionId: number): void {
    this.osc.off(event, subscriptionId);
  }
}
