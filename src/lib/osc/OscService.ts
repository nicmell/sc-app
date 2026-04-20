import OSC from 'osc-js';
import {
  bufAllocMessage,
  bufFreeMessage,
  bufGetnMessage,
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
import {rootApi, optionsApi} from '@/lib/stores/api';
import {logger} from '@/lib/logger';
import {IS_TAURI} from '@/lib/env';
import {TauriUdpPlugin} from './TauriUdpPlugin';

import {ConnectionStatus, DEFAULT_CLIENT_ID} from '@/constants/osc';
import {startGlobalClock, stopGlobalClock} from '@/lib/clock/globalClock';

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
      logger.log('Disconnected.');
      // Fire-and-forget — socket is closing anyway; the Rust ClockService
      // resets its own state on the next `clock_start`.
      void this.tearDownClock();
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
      void this.postConnect();
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

  /** Fires once per connect, when status flips to CONNECTED (client id,
   *  sample rate, and server version all known). Starts the Rust clock
   *  service listener (Tauri only — serve mode owns the clock server-side)
   *  and spawns the broadcaster synth at the head of the default group.
   *
   *  The two steps are in independent try/catch blocks so a failure in
   *  one doesn't prevent the other: starting the Rust listener without a
   *  broadcaster leaves readers in `Waiting`, but is recoverable; spawning
   *  the broadcaster without the listener still lets /tr reach the frontend
   *  (unused today, but the architectural separation is clean). */
  private async postConnect(): Promise<void> {
    console.log('[clock] postConnect: starting Rust ClockService');
    if (IS_TAURI) {
      try {
        const {invoke} = await import('@tauri-apps/api/core');
        const {host, port} = optionsApi.scsynth;
        await invoke('clock_start', {
          scsynthAddr: `${host}:${port}`,
          // scsynth reports sampleRate as a double (e.g. 48000.279 — its
          // measured rate, not the nominal). Round for i32 on the Rust side.
          sampleRate: Math.round(rootApi.serverStatus.sampleRate),
        });
        console.log('[clock] Rust ClockService started');
      } catch (e) {
        console.error('[clock] clock_start failed:', e);
        logger.log(`clock_start failed: ${e}`);
      }
    }
    try {
      console.log('[clock] spawning broadcaster synth on scsynth');
      await startGlobalClock(this.defaultGroupId());
      console.log('[clock] broadcaster synth running');
    } catch (e) {
      console.error('[clock] startGlobalClock failed:', e);
      logger.log(`startGlobalClock failed: ${e}`);
    }
  }

  private async tearDownClock(): Promise<void> {
    try { await stopGlobalClock(); } catch { /* socket already closed */ }
    if (IS_TAURI) {
      try {
        const {invoke} = await import('@tauri-apps/api/core');
        await invoke('clock_stop');
      } catch { /* Rust service already gone */ }
    }
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

  /** Register a one-shot listener on `address`; resolve as soon as an
   *  incoming message there satisfies `match`. Rejects after replyTimeoutMs.
   *  Listener must be registered BEFORE the `send()` that prompts the reply,
   *  otherwise the reply can race in before we're listening. */
  private once(
      address: string,
      match: (msg: InstanceType<typeof OSC.Message>) => boolean,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let subId: number | undefined;
      const timer = globalThis.setTimeout(() => {
        if (subId !== undefined) this.osc.off(address, subId);
        reject(new Error(`OscService.once: timed out waiting for ${address}`));
      }, optionsApi.scsynth.replyTimeoutMs);
      subId = this.osc.on(address, (...args: unknown[]) => {
        const msg = args[0] as InstanceType<typeof OSC.Message>;
        if (!match(msg)) return;
        if (subId !== undefined) this.osc.off(address, subId);
        globalThis.clearTimeout(timer);
        resolve();
      });
    });
  }

  async createGroup(nodeId: number, groupId: number, run: boolean): Promise<void> {
    const replyArrived = this.once(
        '/n_go',
        msg => (msg.args as number[])[0] === nodeId,
    );
    this.send(
        newGroupMessage(nodeId),
        nodeRunMessage(nodeId, run ? 1 : 0),
        groupTailMessage(groupId, -1),
    );
    await replyArrived;
  }

  async freeGroup(nodeId: number): Promise<void> {
    const replyArrived = this.once(
        '/n_end',
        msg => (msg.args as number[])[0] === nodeId,
    );
    this.send(
        groupFreeAllMessage(nodeId),
        freeNodeMessage(nodeId),
    );
    await replyArrived;
  }

  async createSynth(name: string, nodeId: number, groupId: number, controls: Record<string, number>, run: boolean): Promise<void> {
    const replyArrived = this.once(
        '/n_go',
        msg => (msg.args as number[])[0] === nodeId,
    );
    this.send(
        newSynthMessage(name, nodeId, 0, 0, controls),
        nodeRunMessage(nodeId, run ? 1 : 0),
        groupTailMessage(groupId, -1),
    );
    await replyArrived;
  }

  async freeSynth(nodeId: number): Promise<void> {
    const replyArrived = this.once(
        '/n_end',
        msg => (msg.args as number[])[0] === nodeId,
    );
    this.send(freeNodeMessage(nodeId));
    await replyArrived;
  }

  /** Spawn a synth at the HEAD of `groupId` (addAction=0, targetId=groupId).
   *  Required for the global clock broadcaster so its `Out.ar(PHASE_BUS)`
   *  runs before any consumer BufWr each block. */
  async createSynthAtHead(name: string, nodeId: number, groupId: number, controls: Record<string, number>): Promise<void> {
    const replyArrived = this.once(
        '/n_go',
        msg => (msg.args as number[])[0] === nodeId,
    );
    this.send(newSynthMessage(name, nodeId, 0, groupId, controls));
    await replyArrived;
  }

  async sendSynthDef(bytes: Uint8Array): Promise<void> {
    const replyArrived = this.once(
        OSC_REPLIES.DONE,
        msg => (msg.args as unknown[])[0] === OSC_MESSAGES.DEF_RECV,
    );
    this.send(defRecvMessage(bytes));
    await replyArrived;
  }

  setControl(nodeId: number, name: string, value: number): void {
    this.send(nodeSetMessage(nodeId, {[name]: value}));
  }

  setNodeRun(nodeId: number, flag: number): void {
    this.send(nodeRunMessage(nodeId, flag));
  }

  async allocBuffer(bufnum: number, frames: number, channels: number): Promise<void> {
    const replyArrived = this.once(
        OSC_REPLIES.DONE,
        msg => {
          const args = msg.args as unknown[];
          return args[0] === OSC_MESSAGES.BUF_ALLOC && args[1] === bufnum;
        },
    );
    this.send(bufAllocMessage(bufnum, frames, channels));
    await replyArrived;
  }

  async freeBuffer(bufnum: number): Promise<void> {
    const replyArrived = this.once(
        OSC_REPLIES.DONE,
        msg => {
          const args = msg.args as unknown[];
          return args[0] === OSC_MESSAGES.BUF_FREE && args[1] === bufnum;
        },
    );
    this.send(bufFreeMessage(bufnum));
    await replyArrived;
  }

  readBuffer(bufnum: number, start: number, count: number): void {
    this.send(bufGetnMessage(bufnum, start, count));
  }
}
