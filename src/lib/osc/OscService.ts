import OSC from 'osc-js';
import {TauriUdpPlugin} from './TauriUdpPlugin';
import {createNotifyMessage, createStatusMessage, createVersionMessage} from './messages';
import {rootStore, dispatch} from '@/lib/stores/rootStore.ts';
import type {ScsynthOptions} from '@/lib/stores/scsynth';
import {setClient, setOptions, setConnectionStatus, setStatus, setVersion, clearClient} from '@/lib/stores/scsynth';
import {logger} from '@/lib/logger';

import {ConnectionStatus} from '@/constants/store';

export class OscService {
  private osc: InstanceType<typeof OSC>;
  private pollingId: ReturnType<typeof setInterval> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private static readonly REPLY_TIMEOUT_MS = 3000;

  constructor() {
    this.osc = new OSC({ plugin: new TauriUdpPlugin() });

    this.osc.on('open', () => {
      this.resetTimeout();
      this.startPolling()
      this.osc.send(createNotifyMessage(1, rootStore.getState().scsynth.clientId));
    });
    this.osc.on('close', () => {
      this.clearTimeout();
      this.stopPolling();
      dispatch(clearClient());
      dispatch(setConnectionStatus(ConnectionStatus.DISCONNECTED));
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
        dispatch(setStatus({ugens, synths, groups, defs, avgCpu, peakCpu, sampleRate}));
        break
      }

      case '/version.reply': {
        const [name, major, minor, patch, branch, hash] = msg.args as (string | number)[];
        dispatch(setVersion(`${name} ${major}.${minor}.${patch} (${branch} ${hash})`));
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
      dispatch(setConnectionStatus(ConnectionStatus.CONNECTED));
      logger.log('Connected.');
    }
    this.logMessage(msg);
  }

  private status() {
    return rootStore.getState().scsynth.connectionStatus
  }

  private init(clientId: number) {
    dispatch(setClient(clientId));
    this.send(
        createStatusMessage(),
        createVersionMessage(),
    )
  }

  getOptions(): ScsynthOptions {
    return rootStore.getState().scsynth.options;
  }

  setOptions(opts: Partial<ScsynthOptions>): void {
    dispatch(setOptions(opts));
  }

  private isReady(): boolean {
    const {scsynth} = rootStore.getState();
    return (
        scsynth.clientId >= 0 && scsynth.status.sampleRate > 0 && scsynth.version.length > 0
    );
  }

  connect(): void {
    const {scsynth} = rootStore.getState();
    const {host, port} = scsynth.options;
    dispatch(setConnectionStatus(ConnectionStatus.CONNECTING));
    this.osc.open({host, port});
  }

  disconnect(): void {
    if (this.osc.status() === OSC.STATUS.IS_OPEN && rootStore.getState().scsynth.clientId >= 0) {
      this.send(createNotifyMessage(0));
    }
    this.osc.close();
  }


  private startPolling(): void {
    this.stopPolling();
    const {pollStatusMs} = this.getOptions();
    this.pollingId = setInterval(() => {
      if (this.isReady()) {
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
    }, OscService.REPLY_TIMEOUT_MS);
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

  on(event: string, handler: (...args: unknown[]) => void): number {
    return this.osc.on(event, handler);
  }

  off(event: string, subscriptionId: number): void {
    this.osc.off(event, subscriptionId);
  }
}
