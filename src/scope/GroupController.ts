/**
 * Owns the app's parent group inside scsynth's node tree. Everything
 * audio-related (clock, scopes, recorders) gets added to children of
 * this group — `/n_run` on the parent then pauses the whole session at
 * once.
 *
 * Lifecycle:
 *   stopped → running (via ensureCreated → /g_new then /n_run 1 implicitly)
 *   running ↔ paused (pause / resume via /n_run 0|1)
 *   running → stopped (free, via /g_freeAll + /n_free)
 *
 * The "disconnected" case is handled at a higher level — `AppShell`
 * tears the whole dashboard down on WebSocket error — so this class
 * only models the three real on-server states.
 */

import {
  AddToHead,
  gFreeAll,
  gNewOne,
  nFree,
  queryTree,
  nRunOne,
} from '@sc-app/server-commands';
import type { ReadonlyStore } from './reactiveStore';
import { createStore } from './reactiveStore';
import type { WorkerClient } from './WorkerClient';
import type { OscReply } from './workerProtocol';

export type GroupState = 'stopped' | 'running' | 'paused';

export class GroupController {
  private readonly stateStore = createStore<GroupState>('stopped');
  private created = false;

  constructor(
    private readonly client: WorkerClient,
    readonly groupId: number,
    private readonly targetId = 0,
    private readonly addAction: number = AddToHead,
  ) {}

  get state(): ReadonlyStore<GroupState> {
    return this.stateStore;
  }

  /** Idempotent — creates the group (running by default) on first call. */
  async ensureCreated(): Promise<void> {
    if (this.created) return;
    await this.client.sendAndSync(
      gNewOne(this.groupId, this.addAction, this.targetId),
    );
    this.created = true;
    this.stateStore.set('running');
  }

  async pause(): Promise<void> {
    await this.client.sendAndSync(nRunOne(this.groupId, 0));
    this.stateStore.set('paused');
  }

  async resume(): Promise<void> {
    await this.client.sendAndSync(nRunOne(this.groupId, 1));
    this.stateStore.set('running');
  }

  /** Frees all children, then the group itself. */
  async free(): Promise<void> {
    if (!this.created) return;
    await this.client.sendAndSync(gFreeAll(this.groupId));
    await this.client.sendAndSync(nFree(this.groupId));
    this.created = false;
    this.stateStore.set('stopped');
  }

  /** `/g_queryTree` for this group. The reply comes back as
   *  `/g_queryTree.reply`. */
  queryTree(): Promise<OscReply> {
    return this.client.sendAndAwaitReply(
      queryTree(this.groupId, true),
      (reply) => reply.address === '/g_queryTree.reply',
    );
  }
}
