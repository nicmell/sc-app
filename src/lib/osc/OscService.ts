import OSC from 'osc-js';
import {TauriUdpPlugin} from './TauriUdpPlugin';
import {
  groupFreeAllMessage,
  dumpOscMessage,
  freeNodeMessage,
  newGroupMessage,
  notifyMessage,
  statusMessage,
  versionMessage
} from './messages';
import type {ScsynthOptions} from '@/types/stores';
import {OSC_MESSAGES, OSC_REPLIES} from '@/constants/osc.ts';
import {scsynthApi} from '@/lib/stores/api';
import {logger} from '@/lib/logger';
import {IS_TAURI} from '@/lib/env';

import {ConnectionStatus, DEFAULT_CLIENT_ID} from '@/constants/osc';

export class OscService {
  private osc: InstanceType<typeof OSC>;
  private pollingId: ReturnType<typeof setInterval> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  private currentNodeId = 0;

  constructor() {
    const plugin = IS_TAURI
        ? new TauriUdpPlugin()
        : new OSC.WebsocketClientPlugin();
    this.osc = new OSC({ plugin });

    this.osc.on('open', () => {
      this.resetTimeout();
      this.startPolling()
      this.osc.send(dumpOscMessage(1))
      this.osc.send(notifyMessage(1, scsynthApi.clientId || this.defaultClientId()));
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
    if (msg.address !== OSC_REPLIES.STATUS) {
      logger.log(`${msg.address} ${(msg.args as unknown[]).join(' ')}`);
    }
  }

  private handleMessage(msg: InstanceType<typeof OSC.Message>): void {
    switch (msg.address) {
      case OSC_REPLIES.STATUS: {
        this.resetTimeout();
        const [, ugens, synths, groups, defs, avgCpu, peakCpu, , sampleRate] = msg.args as number[];
        scsynthApi.setStatus({ugens, synths, groups, defs, avgCpu, peakCpu, sampleRate});
        break
      }

      case OSC_REPLIES.VERSION: {
        const [name, major, minor, patch, branch, hash] = msg.args as (string | number)[];
        scsynthApi.setVersion(`${name} ${major}.${minor}.${patch} (${branch} ${hash})`);
        break
      }
      case OSC_REPLIES.DONE: {
        if (msg.args[0] === OSC_MESSAGES.NOTIFY) {
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
    this.currentNodeId = this.defaultGroupId();
    this.send(
        newGroupMessage(this.currentNodeId),
        statusMessage(),
        versionMessage()
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
    scsynthApi.setConnectionStatus(ConnectionStatus.CONNECTING);
    if (IS_TAURI) {
      const {host, port} = scsynthApi.options;
      this.osc.open({host, port});
    } else {
      // WebsocketClientPlugin connects to the serve origin's /ws endpoint
      this.osc.open({host: location.hostname, port: Number(location.port) || 3000});
    }
  }

  disconnect(): void {
    if (this.osc.status() === OSC.STATUS.IS_OPEN && scsynthApi.clientId >= 0) {
      this.send(
          groupFreeAllMessage(this.defaultGroupId()),
          freeNodeMessage(this.defaultGroupId()),
      );
      this.send(notifyMessage(0));
    }
    this.osc.close();
  }


  private startPolling(): void {
    this.stopPolling();
    const {pollStatusMs} = this.getOptions();
    this.pollingId = setInterval(() => {
      if (this.osc.status() === OSC.STATUS.IS_OPEN && this.isReady()) {
        this.send(statusMessage());
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

  send(...msg: (InstanceType<typeof OSC.Message> | undefined)[]): void {
    const filtered = msg.filter((m): m is InstanceType<typeof OSC.Message> => m !== undefined);
    if (filtered.length === 1) {
      return this.osc.send(filtered[0]);
    } else if (filtered.length > 1) {
      const bundle = new OSC.Bundle(filtered, Date.now() + scsynthApi.options.msgLatencyMs);
      return this.osc.send(bundle);
    }
  }

  defaultGroupId(): number {
    return (scsynthApi.clientId + 1) * 1000;
  }

  nextNodeId(): number {
    return (this.currentNodeId += 1);
  }

  private defaultClientId() {
    return scsynthApi.options.clientId || DEFAULT_CLIENT_ID;
  }

  on(event: string, handler: (...args: unknown[]) => void): number {
    return this.osc.on(event, handler);
  }

  off(event: string, subscriptionId: number): void {
    this.osc.off(event, subscriptionId);
  }
}
