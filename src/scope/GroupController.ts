/**
 * Owns the app's parent group inside scsynth's node tree. Everything
 * audio-related (clock, scopes, recorders) gets added as children
 * of this group, so a single `/g_freeAll + /n_free` cleans up the
 * whole session.
 *
 * Lifecycle:
 *   stopped → running (via `ensureCreated` → /g_new)
 *   running → stopped (via `free` → /g_freeAll + /n_free)
 *
 * Pause/resume used to live here too (group-wide `/n_run 0|1`), but
 * the clock now manages its own pause via `/n_run` on its synth
 * directly — see `ClockController`. Group-level pause is no longer
 * needed and was removed to keep the state model minimal.
 */

import {
  AddToHead,
  gFreeAll,
  gNewOne,
  nFree,
} from '@sc-app/server-commands';
import type { ReadonlyStore } from './reactiveStore';
import { createStore } from './reactiveStore';
import type { WorkerClient } from './WorkerClient';

export type GroupState = 'stopped' | 'running';

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

  /** Idempotent — creates the group on first call. */
  async ensureCreated(): Promise<void> {
    if (this.created) return;
    await this.client.sendAndSync(
      gNewOne(this.groupId, this.addAction, this.targetId),
    );
    this.created = true;
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
}
