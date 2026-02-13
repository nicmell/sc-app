import OSC from 'osc-js';
import {TauriUdpPlugin} from './TauriUdpPlugin';
import {createNotifyMessage, createStatusMessage} from './messages';
import {appStore, type ScsynthOptions, type ScsynthStatus} from '@/lib/stores/appStore';
import {logger} from '@/lib/logger';

import {ConnectionStatus} from '@/lib/constants';

function parseStatusReply(args: unknown[]): ScsynthStatus {
  const [, ugens, synths, groups, defs, avgCpu, peakCpu, , sampleRate] = args as number[];
  return {ugens, synths, groups, defs, avgCpu, peakCpu, sampleRate};
}


function parseVersionReply(args: unknown[]): string {
  const [name, major, minor, patch, branch, hash] = args as (string | number)[];
  return `${name} ${major}.${minor}.${patch} (${branch} ${hash})`;
}

export class OscService {
  private osc: InstanceType<typeof OSC>;
  private pollingId: ReturnType<typeof setInterval> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private static readonly REPLY_TIMEOUT_MS = 3000;

  constructor() {
    this.osc = new OSC({ plugin: new TauriUdpPlugin() });

    this.osc.on('open', () => {
      this.osc.send(createNotifyMessage(1, appStore.getState().scsynth.clientId));
    });
    this.osc.on('close', () => {
      logger.log('Disconnected.')
    });
    this.osc.on('error', (err: unknown) => logger.log(`Error: ${err}`));
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
    this.logMessage(msg);
    switch (msg.address) {
      case '/status.reply': {
        const status = parseStatusReply(msg.args as unknown[]);
        appStore.getState().scsynth.setStatus(status);
        this.resetTimeout();
        break;
      }
      case '/version.reply': {
        const version = parseVersionReply(msg.args as unknown[]);
        appStore.getState().scsynth.setVersion(version);
        break;
      }
      case '/done': {
        if (msg.args[0] === '/notify') {
          appStore.getState().scsynth.setClient(msg.args[1] as number);
          this.startPolling();
          appStore.getState().scsynth.setConnectionStatus(ConnectionStatus.CONNECTED);
          logger.log('Connected.')
        }
        break
      }
    }
    if (msg.address !== '/status.reply') {
      logger.log(`${msg.address} ${(msg.args as unknown[]).join(' ')}`);
    }
  }

  getOptions(): ScsynthOptions {
    return appStore.getState().scsynth.options;
  }

  setOptions(opts: Partial<ScsynthOptions>): void {
    appStore.getState().scsynth.setOptions(opts);
  }

  get status(): number {
    return this.osc.status();
  }

  connect(): void {
    const {scsynth} = appStore.getState();
    const {host, port} = this.getOptions();
    scsynth.setConnectionStatus(ConnectionStatus.CONNECTING);
    this.startPolling()
    this.osc.open({host, port});
  }

  disconnect(): void {
    this.stopPolling();
    this.osc.send(createNotifyMessage(0));
    //appStore.getState().scsynth.clearClient();
    appStore.getState().scsynth.setConnectionStatus(ConnectionStatus.DISCONNECTED);
    this.osc.close();
  }


  private startPolling(): void {
    this.stopPolling();
    const {pollStatusMs} = this.getOptions();
    this.pollingId = setInterval(() => {
      this.osc.send(createStatusMessage());
    }, pollStatusMs);
    this.resetTimeout();
  }

  private stopPolling(): void {
    if (this.pollingId !== null) {
      clearInterval(this.pollingId);
      this.pollingId = null;
    }
    this.clearTimeout();
  }

  private resetTimeout(): void {
    this.clearTimeout();
    this.timeoutId = setTimeout(() => {
      logger.log('No status.reply received for 3 seconds, disconnecting.');
      void this.disconnect();
    }, OscService.REPLY_TIMEOUT_MS);
  }

  private clearTimeout(): void {
    if (this.timeoutId !== null) {
      globalThis.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  send(msg:  OSC.Packet | OSC.Bundle | OSC.Message | OSC.TypedMessage): void {
    this.osc.send(msg);
  }

  on(event: string, handler: (...args: unknown[]) => void): number {
    return this.osc.on(event, handler);
  }

  off(event: string, subscriptionId: number): void {
    this.osc.off(event, subscriptionId);
  }
}
