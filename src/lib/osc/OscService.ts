import OSC from 'osc-js';
import {
  bufAllocMessage,
  bufCloseMessage,
  bufFreeMessage,
  bufGetnMessage,
  bufWriteMessage,
  defRecvMessage,
  dumpOscMessage,
  freeNodeMessage,
  groupFreeAllMessage,
  groupTailMessage,
  newGroupMessage,
  newSynthMessage,
  nodeRunMessage,
  nodeSetMessage,
  notifyMessage,
  statusMessage,
  versionMessage,
} from './messages';
import type {ScsynthOptions} from '@/types/stores';
import {OSC_MESSAGES, OSC_REPLIES} from '@/constants/osc.ts';
import {rootApi, optionsApi, runtimeApi} from '@/lib/stores/api';
import {logger} from '@/lib/logger';
import {IS_TAURI} from '@/lib/env';
import {TauriUdpPlugin} from './TauriUdpPlugin';

import {ConnectionStatus, DEFAULT_CLIENT_ID} from '@/constants/osc';

export class OscService {
  private osc: InstanceType<typeof OSC>;
  private pollingId: ReturnType<typeof setInterval> | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  private currentNodeId = 0;
  private currentBufNum = 0;

  constructor() {
    const plugin = IS_TAURI
        ? new TauriUdpPlugin()
        : new OSC.WebsocketClientPlugin();
    this.osc = new OSC({ plugin });

    this.osc.on('open', () => {
      this.resetTimeout();
      this.startPolling()
      this.osc.send(dumpOscMessage(1))
      this.osc.send(notifyMessage(1, rootApi.clientId || this.defaultClientId()));
    });
    this.osc.on('close', () => {
      this.clearTimeout();
      this.stopPolling();
      rootApi.clearClient();
      rootApi.setConnectionStatus(ConnectionStatus.DISCONNECTED);
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
        rootApi.setStatus({ugens, synths, groups, defs, avgCpu, peakCpu, sampleRate});
        break
      }

      case OSC_REPLIES.VERSION: {
        const [name, major, minor, patch, branch, hash] = msg.args as (string | number)[];
        rootApi.setVersion(`${name} ${major}.${minor}.${patch} (${branch} ${hash})`);
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
      rootApi.setConnectionStatus(ConnectionStatus.CONNECTED);
      logger.log('Connected.');
    }
    this.logMessage(msg);
  }

  private status() {
    return rootApi.connectionStatus;
  }

  private init(clientId: number) {
    rootApi.setClient(clientId);
    this.currentNodeId = this.defaultGroupId();
    this.currentBufNum = (clientId + 1) * 100;
    this.send(
        newGroupMessage(this.currentNodeId),
        nodeRunMessage(this.currentNodeId, 0),
        statusMessage(),
        versionMessage()
    )
  }

  getOptions(): ScsynthOptions {
    return optionsApi.scsynth;
  }

  setOptions(opts: Partial<ScsynthOptions>): void {
    optionsApi.setScsynthOptions(opts);
  }

  private isReady(): boolean {
    return (
        rootApi.clientId >= 0 && rootApi.serverStatus.sampleRate > 0 && rootApi.serverVersion.length > 0
    );
  }

  connect(): void {
    rootApi.setConnectionStatus(ConnectionStatus.CONNECTING);
    if (IS_TAURI) {
      const {host, port} = optionsApi.scsynth;
      this.osc.open({host, port});
    } else {
      this.osc.open({host: location.hostname, port: Number(location.port) || 3000});
    }
  }

  disconnect(): void {
    if (this.osc.status() === OSC.STATUS.IS_OPEN && rootApi.clientId >= 0) {
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
    }, optionsApi.scsynth.replyTimeoutMs);
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
      const bundle = new OSC.Bundle(filtered, Date.now() + optionsApi.scsynth.msgLatencyMs);
      return this.osc.send(bundle);
    }
  }

  // --- ID allocation ---

  defaultGroupId(): number {
    return (rootApi.clientId + 1) * 1000;
  }

  nextNodeId(): number {
    return (this.currentNodeId += 1);
  }

  nextBufNum(): number {
    return (this.currentBufNum += 1);
  }

  defaultClientId() {
    return optionsApi.scsynth.clientId || DEFAULT_CLIENT_ID;
  }

  // --- Event subscription ---

  on(event: string, handler: (...args: unknown[]) => void): number {
    return this.osc.on(event, handler);
  }

  off(event: string, subscriptionId: number): void {
    this.osc.off(event, subscriptionId);
  }

  // --- scsynth operations ---

  createGroup(id: string, nodeId: number, groupId: number, run: boolean): void {
    this.send(
        newGroupMessage(nodeId),
        nodeRunMessage(nodeId, run ? 1 : 0),
        groupTailMessage(groupId, -1),
    );
    runtimeApi.newGroup({id, nodeId});
  }

  freeGroup(id: string, nodeId: number): void {
    this.send(
        groupFreeAllMessage(nodeId),
        freeNodeMessage(nodeId),
    );
    runtimeApi.freeGroup({id});
  }

  createSynth(id: string, name: string, nodeId: number, groupId: number, controls: Record<string, number>, run: boolean): void {
    this.send(
        newSynthMessage(name, nodeId, 0, 0, controls),
        nodeRunMessage(nodeId, run ? 1 : 0),
        groupTailMessage(groupId, -1),
    );
    runtimeApi.newSynth({id, nodeId});
  }

  freeSynth(id: string, nodeId: number): void {
    this.send(freeNodeMessage(nodeId));
    runtimeApi.freeSynth({id});
  }

  sendSynthDef(id: string, bytes: Uint8Array): void {
    this.send(defRecvMessage(bytes));
    runtimeApi.loadSynthdef({id});
  }

  setControl(nodeId: number, name: string, value: number): void {
    this.send(nodeSetMessage(nodeId, {[name]: value}));
  }

  setNodeRun(nodeId: number, flag: number, id?: string): void {
    this.send(nodeRunMessage(nodeId, flag));
    if (id) runtimeApi.setRunning({nodeId: id, value: flag});
  }

  allocBuffer(id: string, bufnum: number, frames: number, channels: number): void {
    this.send(bufAllocMessage(bufnum, frames, channels));
    runtimeApi.allocBuffer({id, bufnum});
  }

  freeBuffer(id: string, bufnum: number): void {
    this.send(bufFreeMessage(bufnum));
    runtimeApi.freeBuffer({id});
  }

  readBuffer(bufnum: number, start: number, count: number): void {
    this.send(bufGetnMessage(bufnum, start, count));
  }

  /** Open a file for streaming writes from `bufnum` (used by sc-record + DiskOut). */
  openBufferWrite(bufnum: number, path: string): void {
    this.send(bufWriteMessage(bufnum, path));
  }

  /** Finalise the WAV file tied to `bufnum` via `openBufferWrite`. */
  closeBufferWrite(bufnum: number): void {
    this.send(bufCloseMessage(bufnum));
  }
}
