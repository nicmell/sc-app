import OSC from 'osc-js';
import {TauriUdpPlugin} from './TauriUdpPlugin';
import {createNotifyMessage, createStatusMessage, createVersionMessage} from './messages';
import type {ScsynthOptions} from '@/types/stores';
import {scsynthApi} from '@/lib/stores/api';
import {logger} from '@/lib/logger';

import {ConnectionStatus, DEFAULT_CLIENT_ID} from '@/constants/osc';

export class OscService {
  private osc: InstanceType<typeof OSC>;
  private pollingId: ReturnType<typeof setInterval> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.osc = new OSC({ plugin: new TauriUdpPlugin() });

    this.osc.on('open', () => {
      this.resetTimeout();
      this.startPolling()
      this.osc.send(createNotifyMessage(1, scsynthApi.clientId || this.defaultClientId()));
    });
    this.osc.on('close', () => {
      this.clearTimeout();
      this.stopPolling();
      scsynthApi.clearClient();
      scsynthApi.setConnectionStatus(ConnectionStatus.DISCONNECTED);
      logger.log('Disconnected.')
    });
    this.osc.on('error', (err: unknown) => {
      logger.log(`Error: ${err}`);
      if (this.status() === ConnectionStatus.CONNECTING) {
        this.disconnect();
      }
    });
    this.osc.on('*', (...args: unknown[]) => {
      const msg = args[0] as InstanceType<typeof OSC.Message>;
      this.handleMessage(msg);
    });
  }

  private logMessage(msg: InstanceType<typeof OSC.Message>) {
    if (msg.address !== '/status.reply') {
      logger.log(`${msg.address} ${(msg.args as unknown[]).join(' ')}`);
    }
  }

  private handleMessage(msg: InstanceType<typeof OSC.Message>): void {
    switch (msg.address) {
      case '/status.reply': {
        this.resetTimeout();
        const [, ugens, synths, groups, defs, avgCpu, peakCpu, , sampleRate] = msg.args as number[];
        scsynthApi.setStatus({ugens, synths, groups, defs, avgCpu, peakCpu, sampleRate});
        break
      }

      case '/version.reply': {
        const [name, major, minor, patch, branch, hash] = msg.args as (string | number)[];
        scsynthApi.setVersion(`${name} ${major}.${minor}.${patch} (${branch} ${hash})`);
        break
      }
      case '/done': {
        if (msg.args[0] === '/notify') {
          const clientId = msg.args[1] as number;
           return this.init(clientId);
        }
        break
      }
    }
    if (this.status() === ConnectionStatus.CONNECTING && this.isReady()) {
      scsynthApi.setConnectionStatus(ConnectionStatus.CONNECTED);
      logger.log('Connected.');
    }
    this.logMessage(msg);
  }

  private status() {
    return scsynthApi.connectionStatus;
  }

  private init(clientId: number) {
    scsynthApi.setClient(clientId);
    this.send(
        createStatusMessage(),
        createVersionMessage(),
    )
  }

  getOptions(): ScsynthOptions {
    return scsynthApi.options;
  }

  setOptions(opts: Partial<ScsynthOptions>): void {
    scsynthApi.setOptions(opts);
  }

  private isReady(): boolean {
    return (
        scsynthApi.clientId >= 0 && scsynthApi.status.sampleRate > 0 && scsynthApi.version.length > 0
    );
  }

  connect(): void {
    const {host, port} = scsynthApi.options;
    scsynthApi.setConnectionStatus(ConnectionStatus.CONNECTING);
    this.osc.open({host, port});
  }

  disconnect(): void {
    if (this.osc.status() === OSC.STATUS.IS_OPEN && scsynthApi.clientId >= 0) {
      this.send(createNotifyMessage(0));
    }
    this.osc.close();
  }


  private startPolling(): void {
    this.stopPolling();
    const {pollStatusMs} = this.getOptions();
    this.pollingId = setInterval(() => {
      if (this.osc.status() === OSC.STATUS.IS_OPEN && this.isReady()) {
        this.send(createStatusMessage());
      }
    }, pollStatusMs);
  }

  private stopPolling(): void {
    if (this.pollingId !== null) {
      clearInterval(this.pollingId);
      this.pollingId = null;
    }
  }

  private resetTimeout(): void {
    this.clearTimeout();
    this.timeoutId = setTimeout(() => {
      if (this.osc.status() === OSC.STATUS.IS_OPEN) {
        logger.log('No status.reply received for 3 seconds, disconnecting.');
      }
      void this.disconnect();
    }, scsynthApi.options.replyTimeoutMs);
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      globalThis.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  send(...msg: InstanceType<typeof OSC.Message>[]): void {
    if (msg.length === 1) {
      return this.osc.send(msg[0]);

    } else if (msg.length > 1) {

      const latency = 200
      const bundle = new OSC.Bundle(msg, Date.now() + latency);

      return this.osc.send(bundle);
    }
  }

  defaultClientId() {
    return scsynthApi.options.clientId || DEFAULT_CLIENT_ID;
  }

  on(event: string, handler: (...args: unknown[]) => void): number {
    return this.osc.on(event, handler);
  }

  off(event: string, subscriptionId: number): void {
    this.osc.off(event, subscriptionId);
  }
}
