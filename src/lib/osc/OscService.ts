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

  constructor() {
    this.osc = new OSC({ plugin: new TauriUdpPlugin() });

    this.osc.on('open', () => logger.log('Connected.'));
    this.osc.on('close', () => logger.log('Disconnected.'));
    this.osc.on('error', (err: unknown) => logger.log(`Error: ${err}`));
    this.osc.on('*', (...args: unknown[]) => {
      const msg = args[0] as InstanceType<typeof OSC.Message>;
      if (msg.address !== '/status.reply') {
        logger.log(`${msg.address} ${(msg.args as unknown[]).join(' ')}`);
      }
      this.handleMessage(msg);
    });
  }

  private handleMessage(msg: InstanceType<typeof OSC.Message>): void {
    switch (msg.address) {
      case '/status.reply': {
        const status = parseStatusReply(msg.args as unknown[]);
        appStore.getState().scsynth.setStatus(status);
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
        }
        break
      }
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

  async connect(): Promise<void> {
    const {scsynth} = appStore.getState();
    scsynth.setConnectionStatus(ConnectionStatus.CONNECTING);
    try {
      const {host, port} = this.getOptions();
      await this.osc.open({host, port});
      this.startPolling();
      this.osc.send(createNotifyMessage(1, scsynth.clientId));
    } catch (e) {
      appStore.getState().scsynth.clearClient();
      throw e;
    }
  }

  private startPolling(): void {
    this.stopPolling();
    const {pollStatusMs} = this.getOptions();
    this.pollingId = setInterval(() => {
      this.osc.send(createStatusMessage());
    }, pollStatusMs);
  }

  private stopPolling(): void {
    if (this.pollingId !== null) {
      clearInterval(this.pollingId);
      this.pollingId = null;
    }
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.osc.send(createNotifyMessage(0));
    appStore.getState().scsynth.clearClient();
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
